-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "safeName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "triangleCount" INTEGER NOT NULL,
    "volumeMm3" REAL NOT NULL,
    "surfaceAreaMm2" REAL NOT NULL,
    "bboxX" REAL NOT NULL,
    "bboxY" REAL NOT NULL,
    "bboxZ" REAL NOT NULL,
    "boundaryEdges" INTEGER NOT NULL,
    "nonManifold" INTEGER NOT NULL,
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Checkout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "cart" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "notes" TEXT,
    "squarePaymentId" TEXT,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "notes" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "baseFeeCents" INTEGER NOT NULL,
    "minimumAdjCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "squarePaymentId" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "Checkout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "unitFactor" REAL NOT NULL DEFAULT 1,
    "scaleX" REAL NOT NULL,
    "scaleY" REAL NOT NULL,
    "scaleZ" REAL NOT NULL,
    "orientation" INTEGER NOT NULL,
    "sizeX" REAL NOT NULL,
    "sizeY" REAL NOT NULL,
    "sizeZ" REAL NOT NULL,
    "material" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "infill" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "printerId" TEXT NOT NULL,
    "printerName" TEXT NOT NULL,
    "gramsEach" REAL NOT NULL,
    "hoursEach" REAL NOT NULL,
    "unitCents" INTEGER NOT NULL,
    "lineCents" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderStatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "customerNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutboxJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "dedupeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Upload_storageKey_key" ON "Upload"("storageKey");

-- CreateIndex
CREATE INDEX "Upload_sha256_idx" ON "Upload"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "Checkout_idempotencyKey_key" ON "Checkout"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Checkout_squarePaymentId_key" ON "Checkout"("squarePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutId_key" ON "Order"("checkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_squarePaymentId_key" ON "Order"("squarePaymentId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");

-- CreateIndex
CREATE INDEX "OrderItem_printerId_idx" ON "OrderItem"("printerId");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_orderId_idx" ON "OrderStatusEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxJob_dedupeKey_key" ON "OutboxJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxJob_status_nextAttemptAt_idx" ON "OutboxJob"("status", "nextAttemptAt");
