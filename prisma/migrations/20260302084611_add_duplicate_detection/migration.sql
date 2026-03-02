-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `image_hash` VARCHAR(255) NULL,
    ADD COLUMN `purchase_date` VARCHAR(20) NULL,
    ADD COLUMN `store_name` VARCHAR(255) NULL,
    ADD COLUMN `total_discount` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `transactions_image_hash_idx` ON `transactions`(`image_hash`);

-- CreateIndex
CREATE INDEX `transactions_user_email_total_amount_created_at_idx` ON `transactions`(`user_email`, `total_amount`, `created_at`);
