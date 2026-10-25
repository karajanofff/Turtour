-- CreateIndex
CREATE UNIQUE INDEX "Notification_bookingId_event_key" ON "Notification"("bookingId", "event");
