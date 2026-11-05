// Coastline Printer: the market stand's print bridge as a Mac app.
//
// Runs print-bridge.mjs (bundled in the app) with Node in the background,
// reads its JSON events and shows what's going on: online, printer found,
// paper and cover warnings, receipts printed today (any of the last ten can
// be reprinted). Lives in the menu bar, so the window can be closed; keeps
// the Mac awake while it runs and can start at login. The bridge key is kept
// in the login keychain. Built by build.sh with swiftc.

import AppKit
import Security
import ServiceManagement
import SwiftUI

// MARK: - Colours (from the logo)

extension Color {
  static let navy = Color(red: 14 / 255, green: 68 / 255, blue: 113 / 255)
  static let deep = Color(red: 8 / 255, green: 44 / 255, blue: 75 / 255)
  static let wave = Color(red: 134 / 255, green: 187 / 255, blue: 234 / 255)
  static let sun = Color(red: 233 / 255, green: 196 / 255, blue: 106 / 255)
  static let good = Color(red: 124 / 255, green: 220 / 255, blue: 150 / 255)
  static let warn = Color(red: 255 / 255, green: 190 / 255, blue: 120 / 255)
}

let server = ProcessInfo.processInfo.environment["COASTLINE_SERVER"] ?? "https://coastlineprints.ca"

// MARK: - Keychain

enum KeyStore {
  static let service = ProcessInfo.processInfo.environment["COASTLINE_KEYCHAIN"] ?? "ca.coastlineprints.printer"
  static func load() -> String? {
    // Testing only: a key straight from the environment, so a test build never touches the keychain.
    if let key = ProcessInfo.processInfo.environment["COASTLINE_KEY"] { return key }
    let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecReturnData as String: true]
    var out: CFTypeRef?
    guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
    return String(data: d, encoding: .utf8)
  }
  static func save(_ key: String) {
    delete()
    let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "bridge", kSecValueData as String: Data(key.utf8)]
    SecItemAdd(q as CFDictionary, nil)
  }
  static func delete() {
    SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service] as CFDictionary)
  }
  /// Finds a bridge key in pasted text (the whole command from the admin page works too).
  static func extract(_ text: String) -> String? {
    guard let r = text.range(of: #"pb_[A-Za-z0-9_-]{20,64}"#, options: .regularExpression) else { return nil }
    return String(text[r])
  }
}

// MARK: - The bridge

struct PrintItem: Identifiable {
  let id: String
  let label: String
  let at: Date
  var status: Status
  var error: String?
  enum Status { case printing, printed, failed }
  /** Reprints are made from the receipts the bridge kept, not from other reprints. */
  var canReprint: Bool { status == .printed && !id.hasPrefix("reprint-") }
}

@MainActor
final class Bridge: ObservableObject {
  static let shared = Bridge()

  enum Phase { case needKey, needNode, starting, connecting, offline, looking, ready, noPrinter, badKey }
  @Published var phase: Phase = .starting
  /// Nil until the bridge has heard back from the site (or failed to).
  @Published var online: Bool?
  @Published var printerHost: String?
  @Published var printerChecked = false
  @Published var adapter = false
  @Published var sharing = false
  @Published var recent: [PrintItem] = []
  @Published var printedToday = 0
  @Published var askForKey = false
  /// From the printer itself: "cover", "paper-out", "paper-low", "cutter", "offline".
  @Published var problems: [String] = []

  private var process: Process?
  private var input: FileHandle?
  private var stopping = false
  private var buffer = Data()
  private var awake: NSObjectProtocol?
  private var timer: Timer?

  init() {
    let d = UserDefaults.standard
    printedToday = d.string(forKey: "countDay") == Self.today ? d.integer(forKey: "count") : 0
  }

  static var today: String { DateFormatter.localizedString(from: Date(), dateStyle: .short, timeStyle: .none) }

  /// Problems in words, for the window and the menu.
  var problemText: [String] {
    let words = ["cover": "The printer's cover is open", "paper-out": "The printer is out of paper", "paper-low": "Paper is running low", "cutter": "The paper cutter is jammed", "offline": "The printer is offline"]
    return problems.map { words[$0] ?? $0 }
  }

  static let nodePath: String? = ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"].first { FileManager.default.isExecutableFile(atPath: $0) }

  func start() {
    guard process == nil else { return }
    guard let node = Self.nodePath else { phase = .needNode; return }
    guard let key = KeyStore.load() else { phase = .needKey; askForKey = true; return }
    guard let script = Bundle.main.path(forResource: "print-bridge", ofType: "mjs") else { return }

    phase = .starting
    stopping = false
    awake = awake ?? ProcessInfo.processInfo.beginActivity(options: [.idleSystemSleepDisabled, .userInitiated], reason: "Printing receipts for the market stand")

    let p = Process()
    p.executableURL = URL(fileURLWithPath: node)
    // Exits when this app goes away (stdin closes), even if the app crashes.
    // In JSON mode the bridge takes commands on stdin and exits when it closes (when this app quits, even by crashing).
    p.arguments = [script]
    let jobs = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Coastline Printer/receipts").path
    p.environment = ["BRIDGE_KEY": key, "BRIDGE_JSON": "1", "SERVER": server, "JOBS_DIR": jobs, "PATH": "/usr/bin:/bin:/usr/sbin:/sbin"]
    let out = Pipe()
    p.standardOutput = out
    p.standardError = FileHandle.nullDevice
    let stdin = Pipe()
    p.standardInput = stdin
    input = stdin.fileHandleForWriting
    out.fileHandleForReading.readabilityHandler = { [weak self] h in
      let data = h.availableData
      Task { @MainActor in self?.consume(data) }
    }
    p.terminationHandler = { [weak self] _ in
      Task { @MainActor in
        guard let self else { return }
        self.process = nil
        if !self.stopping && self.phase != .badKey {
          try? await Task.sleep(nanoseconds: 3_000_000_000)
          self.start()
        }
      }
    }
    do {
      try p.run()
      process = p
    } catch {
      phase = .needNode
    }

    checkNetwork()
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in Task { @MainActor in self?.checkNetwork() } }
  }

  /// Prints one of the kept receipts again (the newest when `id` is nil).
  func reprint(_ id: String? = nil) {
    input?.write(Data("reprint \(id ?? "")\n".utf8))
  }

  func stop() {
    stopping = true
    process?.terminate()
    process = nil
  }

  func setKey(_ key: String) {
    KeyStore.save(key)
    askForKey = false
    stop()
    phase = .starting
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.start() }
  }

  private func consume(_ data: Data) {
    buffer.append(data)
    while let nl = buffer.firstIndex(of: 0x0A) {
      let line = buffer[buffer.startIndex..<nl]
      buffer.removeSubrange(buffer.startIndex...nl)
      guard let obj = try? JSONSerialization.jsonObject(with: line) as? [String: Any], let type = obj["type"] as? String else { continue }
      handle(type, obj)
    }
  }

  private func handle(_ type: String, _ e: [String: Any]) {
    switch type {
    case "online":
      online = true
    case "offline":
      online = false
    case "printer":
      let host = e["host"] as? String
      if host != nil && printerHost == nil { NSSound(named: "Hero")?.play() }
      printerHost = host
      printerChecked = true
    case "printing":
      recent.insert(PrintItem(id: e["id"] as? String ?? UUID().uuidString, label: e["label"] as? String ?? "Receipt", at: Date(), status: .printing), at: 0)
      recent = Array(recent.prefix(30))
    case "printed":
      update(e["id"] as? String, .printed)
      if !(e["id"] as? String ?? "").hasPrefix("reprint-") { bumpCount() }
      NSSound(named: "Glass")?.play()
    case "status":
      let next = e["problems"] as? [String] ?? []
      // A new problem that stops printing gets a sound, so it's noticed across the stand.
      if next.contains(where: { $0 != "paper-low" && !problems.contains($0) }) { NSSound(named: "Sosumi")?.play() }
      problems = next
    case "history":
      // Receipts kept from before the app was last opened, so they can still be reprinted.
      guard recent.isEmpty, let jobs = e["jobs"] as? [[String: Any]] else { break }
      recent = jobs.map { PrintItem(id: $0["id"] as? String ?? UUID().uuidString, label: $0["label"] as? String ?? "Receipt", at: Date(timeIntervalSince1970: ($0["at"] as? Double ?? 0) / 1000), status: .printed) }
    case "failed":
      update(e["id"] as? String, .failed, error: e["error"] as? String)
      NSSound(named: "Basso")?.play()
    case "badkey":
      KeyStore.delete()
      phase = .badKey
      askForKey = true
      stop()
      return
    default:
      break
    }
    refreshPhase()
  }

  private func update(_ id: String?, _ s: PrintItem.Status, error: String? = nil) {
    if let i = recent.firstIndex(where: { $0.id == id }) {
      recent[i].status = s
      recent[i].error = error
    }
  }

  private func bumpCount() {
    let d = UserDefaults.standard
    if d.string(forKey: "countDay") != Self.today { printedToday = 0 }
    printedToday += 1
    d.set(Self.today, forKey: "countDay")
    d.set(printedToday, forKey: "count")
  }

  private func refreshPhase() {
    guard phase != .badKey, phase != .needKey, phase != .needNode else { return }
    if online == false { phase = .offline }
    else if !printerChecked { phase = .looking }
    else if printerHost == nil { phase = .noPrinter }
    else { phase = online == true ? .ready : .connecting }
  }

  /// Is a USB ethernet adapter plugged in, and is Internet Sharing giving the printer an address?
  func checkNetwork() {
    Task.detached {
      let ports = shell("/usr/sbin/networksetup", ["-listallhardwareports"])
      var devices: [String] = []
      var port = ""
      for line in ports.split(separator: "\n") {
        if line.hasPrefix("Hardware Port: ") { port = String(line.dropFirst(15)) }
        if line.hasPrefix("Device: "), !port.contains("Wi-Fi"), !port.contains("Bluetooth"), !port.contains("Thunderbolt Bridge") { devices.append(String(line.dropFirst(8))) }
      }
      let plugged = devices.filter { shell("/sbin/ifconfig", [$0]).contains("status: active") }
      let active = !plugged.isEmpty
      // Internet Sharing joins the ports it shares to into bridge100. It has to include the adapter the printer is on,
      // not just be switched on (it's easy to tick the wrong "Ethernet" port in Settings).
      let bridge = shell("/sbin/ifconfig", ["bridge100"])
      let shared = bridge.contains("inet ") && plugged.contains { bridge.contains("member: \($0) ") }
      await MainActor.run {
        self.adapter = active
        self.sharing = shared
      }
    }
  }
}

func shell(_ path: String, _ args: [String]) -> String {
  let p = Process()
  p.executableURL = URL(fileURLWithPath: path)
  p.arguments = args
  let out = Pipe()
  p.standardOutput = out
  p.standardError = FileHandle.nullDevice
  guard (try? p.run()) != nil else { return "" }
  let data = out.fileHandleForReading.readDataToEndOfFile()
  p.waitUntilExit()
  return String(data: data, encoding: .utf8) ?? ""
}

// MARK: - App

@main
struct CoastlinePrinterApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate
  @StateObject private var bridge = Bridge.shared

  var body: some Scene {
    Window("Coastline Printer", id: "main") {
      ContentView()
        .environmentObject(bridge)
        .onAppear {
          NSApp.setActivationPolicy(.regular)
          bridge.start()
        }
    }
    .windowResizability(.contentSize)
    .windowStyle(.hiddenTitleBar)
    .commands {
      CommandGroup(after: .appSettings) {
        Button("Change Bridge Key…") { bridge.askForKey = true }
        Button("Reprint Last Receipt") { bridge.reprint() }.keyboardShortcut("p", modifiers: [.command, .shift])
      }
    }

    MenuBarExtra {
      MenuPanel().environmentObject(bridge)
    } label: {
      Image(nsImage: menuBarIcon(bridge.light))
    }
    .menuBarExtraStyle(.window)
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationDidFinishLaunching(_ notification: Notification) {
    MainActor.assumeIsolated { Bridge.shared.start() }
    // Closing the window leaves it running in the menu bar, without a Dock icon.
    NotificationCenter.default.addObserver(forName: NSWindow.willCloseNotification, object: nil, queue: .main) { note in
      guard let closing = note.object as? NSWindow, closing.styleMask.contains(.titled) else { return }
      DispatchQueue.main.async {
        if !NSApp.windows.contains(where: { $0 !== closing && $0.isVisible && $0.styleMask.contains(.titled) }) { NSApp.setActivationPolicy(.accessory) }
      }
    }

    // For checking the design: COASTLINE_SNAPSHOT=/path.png saves the windows as pictures after a few seconds.
    guard let path = ProcessInfo.processInfo.environment["COASTLINE_SNAPSHOT"] else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 8) {
      // One picture per open window (the key sheet is a window of its own): path, path-1.png...
      // The menu bar panel, drawn off screen.
      MainActor.assumeIsolated {
        let renderer = ImageRenderer(content: MenuPanel().environmentObject(Bridge.shared))
        renderer.scale = 2
        if let img = renderer.nsImage, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) {
          try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path.replacingOccurrences(of: ".png", with: "-menu.png")))
        }
      }
      for (i, window) in NSApp.windows.filter(\.isVisible).enumerated() {
        guard let view = window.contentView?.superview, let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { continue }
        view.cacheDisplay(in: view.bounds, to: rep)
        try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: i == 0 ? path : path.replacingOccurrences(of: ".png", with: "-\(i).png")))
      }
    }
  }
  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
  func applicationWillTerminate(_ notification: Notification) {
    MainActor.assumeIsolated { Bridge.shared.stop() }
  }
}

// MARK: - Menu bar

extension Bridge {
  /// The little light on the menu bar icon.
  enum Light { case good, warn, busy, off }
  var light: Light {
    switch phase {
    case .ready: return problems.contains(where: { $0 != "paper-low" }) ? .warn : problems.isEmpty ? .good : .warn
    case .looking, .starting, .connecting: return .busy
    case .needKey, .needNode: return .off
    default: return .warn
    }
  }
}

/// The Coastline mark at menu bar size, in its own colours, with a status light.
func menuBarIcon(_ light: Bridge.Light) -> NSImage {
  let image = NSImage(size: NSSize(width: 24, height: 18), flipped: true) { _ in
    let k = 17.0 / 32.0
    let o = NSPoint(x: 0.5, y: 0.5)
    NSColor(Color.navy).setFill()
    let circle = NSBezierPath(ovalIn: NSRect(x: o.x, y: o.y, width: 17, height: 17))
    circle.fill()
    NSColor.white.withAlphaComponent(0.55).setStroke()
    circle.lineWidth = 0.8
    circle.stroke()
    NSColor(Color.sun).setFill()
    NSBezierPath(ovalIn: NSRect(x: o.x + 18.5 * k, y: o.y + 7 * k, width: 6 * k, height: 6 * k)).fill()
    func wave(y: Double, from: Double, step: Double, amp: Double, color: NSColor, width: Double) {
      let path = NSBezierPath()
      path.move(to: NSPoint(x: o.x + from * k, y: o.y + y * k))
      for i in 0..<3 {
        let x = from + Double(i) * step
        path.curve(to: NSPoint(x: o.x + (x + step / 2) * k, y: o.y + y * k), controlPoint1: NSPoint(x: o.x + (x + step / 4) * k, y: o.y + (y - amp) * k), controlPoint2: NSPoint(x: o.x + (x + step / 4) * k, y: o.y + (y - amp) * k))
        path.curve(to: NSPoint(x: o.x + (x + step) * k, y: o.y + y * k), controlPoint1: NSPoint(x: o.x + (x + step * 0.75) * k, y: o.y + (y + amp) * k), controlPoint2: NSPoint(x: o.x + (x + step * 0.75) * k, y: o.y + (y + amp) * k))
      }
      path.lineWidth = width * k
      path.lineCapStyle = .round
      color.setStroke()
      path.stroke()
    }
    wave(y: 17, from: 5, step: 6.6, amp: 2.2, color: .white, width: 2.8)
    wave(y: 22.5, from: 7, step: 5.4, amp: 1.8, color: NSColor(Color.wave), width: 2.6)
    let dot: NSColor? = switch light {
      case .good: NSColor(Color.good)
      case .warn: NSColor(Color.warn)
      case .busy: NSColor(Color.wave)
      case .off: nil
    }
    if let dot {
      let r = NSRect(x: 16, y: 10, width: 7.5, height: 7.5)
      NSColor.black.withAlphaComponent(0.35).setFill()
      NSBezierPath(ovalIn: r.insetBy(dx: -1, dy: -1)).fill()
      dot.setFill()
      NSBezierPath(ovalIn: r).fill()
    }
    return true
  }
  image.isTemplate = false
  return image
}

struct MenuPanel: View {
  @EnvironmentObject var bridge: Bridge
  @Environment(\.openWindow) private var openWindow

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 10) {
        Mark(size: 34)
        VStack(alignment: .leading, spacing: 1) {
          Text("Coastline Printer").font(.system(size: 15, weight: .bold, design: .rounded))
          Text(StatusCard.look(bridge).title).font(.system(size: 12, weight: .medium)).foregroundStyle(StatusCard.look(bridge).color)
        }
      }
      ForEach(bridge.problemText, id: \.self) { p in
        Label(p, systemImage: "exclamationmark.triangle.fill").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.warn)
      }
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        Text("\(bridge.printedToday)").font(.system(size: 26, weight: .bold, design: .rounded)).foregroundStyle(Color.sun)
        Text("printed today").font(.system(size: 12)).foregroundStyle(.white.opacity(0.7))
      }
      RecentList(limit: 4, compact: true)
      Button { bridge.reprint() } label: { Label("Reprint last receipt", systemImage: "arrow.clockwise").frame(maxWidth: .infinity) }
        .buttonStyle(PillButton(filled: true))
        .disabled(!bridge.recent.contains(where: \.canReprint))
      Divider().overlay(Color.white.opacity(0.1))
      LoginToggle()
      HStack {
        Button("Open window") {
          NSApp.setActivationPolicy(.regular)
          openWindow(id: "main")
          NSApp.activate(ignoringOtherApps: true)
        }
        Spacer()
        Button("Quit") { NSApp.terminate(nil) }
      }
      .buttonStyle(PillButton())
    }
    .padding(16)
    .frame(width: 300)
    .background(Color.navy)
    .foregroundStyle(.white)
    .preferredColorScheme(.dark)
  }
}

// MARK: - Views

struct ContentView: View {
  @EnvironmentObject var bridge: Bridge

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Header()
      StatusCard()
      Checklist()
      TodayCard()
      MenuBarCard()
      HStack {
        Button("Receipts page") { NSWorkspace.shared.open(URL(string: "\(server)/admin/receipts")!) }
        Spacer()
        Button("Change key") { bridge.askForKey = true }
      }
      .buttonStyle(PillButton())
    }
    .padding(.horizontal, 24)
    .padding(.top, 34)
    .padding(.bottom, 22)
    .frame(width: 440)
    .background(Color.navy)
    .foregroundStyle(.white)
    .preferredColorScheme(.dark)
    .sheet(isPresented: $bridge.askForKey) { KeySheet() }
  }
}

/// The Coastline mark: sun over two waves, in a circle.
struct Mark: View {
  var size: CGFloat = 52
  var body: some View {
    Canvas { ctx, s in
      let k = s.width / 32
      ctx.fill(Path(ellipseIn: CGRect(x: 0, y: 0, width: s.width, height: s.height)), with: .color(.deep))
      ctx.fill(Path(ellipseIn: CGRect(x: 18.5 * k, y: 7 * k, width: 6 * k, height: 6 * k)), with: .color(.sun))
      var w1 = Path()
      w1.move(to: CGPoint(x: 5 * k, y: 17 * k))
      for i in 0..<3 {
        let x = (5 + Double(i) * 6.6) * k
        w1.addQuadCurve(to: CGPoint(x: x + 3.3 * k, y: 17 * k), control: CGPoint(x: x + 1.65 * k, y: 15 * k))
        w1.addQuadCurve(to: CGPoint(x: x + 6.6 * k, y: 17 * k), control: CGPoint(x: x + 4.95 * k, y: 19 * k))
      }
      ctx.stroke(w1, with: .color(.white), style: StrokeStyle(lineWidth: 2.6 * k, lineCap: .round))
      var w2 = Path()
      w2.move(to: CGPoint(x: 7 * k, y: 22.5 * k))
      for i in 0..<3 {
        let x = (7 + Double(i) * 5.4) * k
        w2.addQuadCurve(to: CGPoint(x: x + 2.7 * k, y: 22.5 * k), control: CGPoint(x: x + 1.35 * k, y: 20.9 * k))
        w2.addQuadCurve(to: CGPoint(x: x + 5.4 * k, y: 22.5 * k), control: CGPoint(x: x + 4.05 * k, y: 24.1 * k))
      }
      ctx.stroke(w2, with: .color(.wave), style: StrokeStyle(lineWidth: 2.4 * k, lineCap: .round))
    }
    .frame(width: size, height: size)
  }
}

struct Header: View {
  var body: some View {
    HStack(spacing: 14) {
      Mark()
      VStack(alignment: .leading, spacing: 2) {
        Text("Coastline Printer").font(.system(size: 24, weight: .bold, design: .rounded))
        Text("Receipts for the LightLab stand").font(.system(size: 13, weight: .medium)).foregroundStyle(Color.wave)
      }
    }
  }
}

struct StatusCard: View {
  @EnvironmentObject var bridge: Bridge
  @State private var pulse = false

  var body: some View {
    let s = Self.look(bridge)
    HStack(spacing: 16) {
      ZStack {
        Circle().fill(s.color.opacity(0.18)).frame(width: 64, height: 64)
          .scaleEffect(s.busy && pulse ? 1.12 : 1)
        Image(systemName: s.icon).font(.system(size: 26, weight: .semibold)).foregroundStyle(s.color)
      }
      VStack(alignment: .leading, spacing: 4) {
        Text(s.title).font(.system(size: 20, weight: .bold, design: .rounded))
        Text(s.detail).font(.system(size: 13)).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
        if bridge.phase == .needNode {
          Button("Get Node") { NSWorkspace.shared.open(URL(string: "https://nodejs.org/en/download")!) }.buttonStyle(PillButton(filled: true)).padding(.top, 4)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(18)
    .background(RoundedRectangle(cornerRadius: 22).fill(Color.deep))
    .onAppear {
      // Breathes in and out the same amount, so the loop never jumps.
      withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { pulse = true }
    }
  }

  static func look(_ bridge: Bridge) -> (icon: String, color: Color, title: String, detail: String, busy: Bool) {
    switch bridge.phase {
    case .ready where !bridge.problems.isEmpty:
      let stops = bridge.problems.contains { $0 != "paper-low" }
      return (stops ? "exclamationmark.triangle.fill" : "scroll.fill", .warn, bridge.problemText.first ?? "Check the printer", stops ? "Receipts wait until it's fixed, then print by themselves." : "Put a new roll in soon. Receipts still print.", stops)
    case .ready: return ("checkmark.circle.fill", .good, "Ready to print", "Ring up a sale on the iPad and the receipt prints here. Leave this open.", false)
    case .looking, .starting: return ("magnifyingglass", .wave, "Looking for the printer…", "Checking the ethernet cable and the network.", true)
    case .noPrinter: return ("printer.dotmatrix.fill", .warn, "Can't find the printer", bridge.adapter && !bridge.sharing ? "Internet Sharing has to share to your USB adapter so the printer gets an address (see below)." : "Check it's switched on and the ethernet cable is plugged in at both ends.", true)
    case .connecting: return ("antenna.radiowaves.left.and.right", .wave, "Connecting…", "Checking in with coastlineprints.ca.", true)
    case .offline: return ("wifi.slash", .warn, "No internet", "Turn on your phone's hotspot and join it. It reconnects by itself.", true)
    case .needKey: return ("key.fill", .sun, "One-time setup", "Paste your bridge key to get started.", false)
    case .badKey: return ("key.slash", .warn, "This key stopped working", "A new key was made on the Receipts page. Paste the new one.", false)
    case .needNode: return ("shippingbox.fill", .warn, "Node isn't installed", "Coastline Printer needs Node to run. Install the LTS version, then reopen this.", false)
    }
  }
}

struct Checklist: View {
  @EnvironmentObject var bridge: Bridge
  var body: some View {
    VStack(spacing: 0) {
      Row(icon: bridge.online == false ? "wifi.slash" : "wifi", ok: bridge.online, text: bridge.online == true ? "Online" : bridge.online == false ? "Not online" : "Connecting…", detail: bridge.online == true ? "coastlineprints.ca" : bridge.online == false ? "Join your hotspot" : nil)
      Divider().overlay(Color.white.opacity(0.08))
      Row(icon: "printer.fill", ok: bridge.printerHost != nil, text: bridge.printerHost != nil ? "Printer found" : "No printer yet", detail: bridge.printerHost ?? "Searching")
      Divider().overlay(Color.white.opacity(0.08))
      if bridge.printerHost != nil {
        // The printer's own report: cover, paper, cutter. Checked every 15 seconds.
        Row(icon: "scroll.fill", ok: bridge.problems.isEmpty, text: bridge.problems.isEmpty ? "Paper and cover OK" : bridge.problemText.joined(separator: ". "), detail: bridge.problems.isEmpty ? "Checked every 15 s" : nil)
        Divider().overlay(Color.white.opacity(0.08))
      }
      if bridge.adapter {
        Row(icon: "cable.connector", ok: bridge.sharing, text: bridge.sharing ? "Ethernet adapter + Internet Sharing" : "Not sharing to the USB adapter", detail: bridge.sharing ? "On" : nil) {
          if !bridge.sharing {
            Button("Fix") { NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.Sharing-Settings.extension")!) }.buttonStyle(PillButton(filled: true))
          }
        }
      } else {
        Row(icon: "cable.connector", ok: nil, text: "No ethernet adapter", detail: "OK at home")
      }
      Divider().overlay(Color.white.opacity(0.08))
      Row(icon: "moon.zzz.fill", ok: true, text: "Keeping this Mac awake", detail: "While this is open")
    }
    .padding(.horizontal, 16)
    .background(RoundedRectangle(cornerRadius: 22).fill(Color.deep))
  }
}

struct Row<Trailing: View>: View {
  let icon: String
  let ok: Bool?
  let text: String
  let detail: String?
  @ViewBuilder var trailing: Trailing

  init(icon: String, ok: Bool?, text: String, detail: String?, @ViewBuilder trailing: () -> Trailing = { EmptyView() }) {
    self.icon = icon
    self.ok = ok
    self.text = text
    self.detail = detail
    self.trailing = trailing()
  }

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: icon).frame(width: 22).foregroundStyle(Color.wave)
      Text(text).font(.system(size: 14, weight: .medium))
      Spacer()
      trailing
      if let detail { Text(detail).font(.system(size: 12)).foregroundStyle(.white.opacity(0.6)) }
      if let ok {
        Image(systemName: ok ? "checkmark.circle.fill" : "exclamationmark.circle.fill").foregroundStyle(ok ? Color.good : Color.warn)
      }
    }
    .padding(.vertical, 11)
  }
}

struct TodayCard: View {
  @EnvironmentObject var bridge: Bridge
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        Text("\(bridge.printedToday)").font(.system(size: 40, weight: .bold, design: .rounded)).foregroundStyle(Color.sun).contentTransition(.numericText())
        Text(bridge.printedToday == 1 ? "receipt printed today" : "receipts printed today").font(.system(size: 14, weight: .medium)).foregroundStyle(.white.opacity(0.8))
      }
      .animation(.spring(duration: 0.4), value: bridge.printedToday)
      RecentList(limit: 5, compact: false)
      // Always shown, so it's easy to find; it wakes up once something has printed.
      Button { bridge.reprint() } label: { Label("Reprint last receipt", systemImage: "arrow.clockwise") }
        .buttonStyle(PillButton(filled: true))
        .disabled(!bridge.recent.contains(where: \.canReprint))
        .help("⇧⌘P")
    }
    .animation(.spring(duration: 0.35), value: bridge.recent.map(\.id))
    .padding(18)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RoundedRectangle(cornerRadius: 22).fill(Color.deep))
  }
}

/// Where the app lives when the window is closed, and starting at login.
struct MenuBarCard: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 10) {
        Image(nsImage: menuBarIcon(.good))
        Text("Close this window and it keeps printing from the menu bar (top right of the screen). Click the icon there for reprints and status.")
          .font(.system(size: 12)).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
      }
      LoginToggle()
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RoundedRectangle(cornerRadius: 22).fill(Color.deep))
  }
}

/// "Start when this Mac logs in", shared by the window and the menu bar panel.
struct LoginToggle: View {
  @State private var atLogin = SMAppService.mainApp.status == .enabled
  var body: some View {
    Toggle("Start when this Mac logs in", isOn: $atLogin)
      .toggleStyle(.switch).controlSize(.small).font(.system(size: 12, weight: .medium))
      .onChange(of: atLogin) { _, on in
        do { on ? try SMAppService.mainApp.register() : try SMAppService.mainApp.unregister() } catch { atLogin = SMAppService.mainApp.status == .enabled }
      }
  }
}

/// The latest receipts, each with a reprint button.
struct RecentList: View {
  @EnvironmentObject var bridge: Bridge
  let limit: Int
  let compact: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 6 : 8) {
      if bridge.recent.isEmpty {
        Text("Nothing printed yet.").font(.system(size: 12)).foregroundStyle(.white.opacity(0.55))
      }
      ForEach(bridge.recent.prefix(limit)) { item in
        HStack(spacing: 10) {
          Image(systemName: item.status == .printed ? "checkmark.circle.fill" : item.status == .failed ? "xmark.circle.fill" : "arrow.down.doc.fill")
            .foregroundStyle(item.status == .printed ? Color.good : item.status == .failed ? Color.warn : Color.wave)
          VStack(alignment: .leading, spacing: 1) {
            Text(item.label).font(.system(size: compact ? 12 : 13, weight: .medium)).lineLimit(1)
            if let e = item.error { Text(e).font(.system(size: 11)).foregroundStyle(Color.warn).lineLimit(2) }
          }
          Spacer()
          Text(item.at, style: .time).font(.system(size: 11)).foregroundStyle(.white.opacity(0.55))
          if item.canReprint {
            Button { bridge.reprint(item.id) } label: { Image(systemName: "arrow.clockwise") }
              .buttonStyle(.plain).foregroundStyle(Color.wave).help("Print this one again")
          }
        }
        .transition(.move(edge: .top).combined(with: .opacity))
      }
    }
    .animation(.spring(duration: 0.35), value: bridge.recent.map(\.id))
  }
}

struct KeySheet: View {
  @EnvironmentObject var bridge: Bridge
  @State private var text = ""
  private var key: String? { KeyStore.extract(text) }

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(spacing: 12) {
        Mark(size: 40)
        Text("Bridge key").font(.system(size: 20, weight: .bold, design: .rounded))
      }
      Text("On the Receipts page, click **Make a bridge key** and copy it. You can paste the whole command; the key is picked out of it.")
        .font(.system(size: 13)).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
      HStack {
        TextField("pb_…", text: $text).textFieldStyle(.roundedBorder).font(.system(size: 13, design: .monospaced))
        Button("Paste") { text = NSPasteboard.general.string(forType: .string) ?? "" }.buttonStyle(PillButton())
      }
      if !text.isEmpty && key == nil {
        Text("That doesn't have a bridge key in it. Keys start with pb_").font(.system(size: 12)).foregroundStyle(Color.warn)
      }
      HStack {
        Button("Open Receipts page") { NSWorkspace.shared.open(URL(string: "\(server)/admin/receipts")!) }.buttonStyle(PillButton())
        Spacer()
        if KeyStore.load() != nil { Button("Cancel") { bridge.askForKey = false }.buttonStyle(PillButton()) }
        Button("Save") { if let key { bridge.setKey(key) } }.buttonStyle(PillButton(filled: true)).disabled(key == nil).keyboardShortcut(.defaultAction)
      }
    }
    .padding(24)
    .frame(width: 420)
    .background(Color.navy)
    .foregroundStyle(.white)
  }
}

/// Pill buttons that squash a little when pressed, like the website's.
struct PillButton: ButtonStyle {
  var filled = false
  func makeBody(configuration: Configuration) -> some View { Pill(configuration: configuration, filled: filled) }

  private struct Pill: View {
    let configuration: Configuration
    let filled: Bool
    @Environment(\.isEnabled) private var enabled
    var body: some View {
      configuration.label
      .font(.system(size: 13, weight: .semibold))
      .padding(.horizontal, 14)
      .padding(.vertical, 7)
      .background(Capsule().fill(filled ? Color.sun : Color.white.opacity(configuration.isPressed ? 0.2 : 0.12)))
      .foregroundStyle(filled ? Color.deep : .white)
      .scaleEffect(x: configuration.isPressed ? 1.04 : 1, y: configuration.isPressed ? 0.92 : 1)
      .animation(.spring(duration: 0.2), value: configuration.isPressed)
      .contentShape(Capsule())
      .opacity(enabled ? 1 : 0.4)
    }
  }
}
