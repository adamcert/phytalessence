-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `sku` VARCHAR(100) NULL,
    `aliases` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticket_id` VARCHAR(100) NOT NULL,
    `user_email` VARCHAR(191) NOT NULL,
    `user_name` VARCHAR(255) NULL,
    `user_phone` VARCHAR(50) NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `ticket_products` JSON NOT NULL,
    `ocr_products` JSON NULL,
    `ocr_used` BOOLEAN NOT NULL DEFAULT false,
    `matched_products` JSON NULL,
    `ticket_image_base64` LONGTEXT NULL,
    `eligible_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `points_calculated` INTEGER NOT NULL DEFAULT 0,
    `points_awarded` BOOLEAN NOT NULL DEFAULT false,
    `notification_sent` BOOLEAN NOT NULL DEFAULT false,
    `snapss_response` JSON NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'PARTIAL') NOT NULL DEFAULT 'PENDING',
    `error_message` TEXT NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `transactions_ticket_id_key`(`ticket_id`),
    INDEX `transactions_user_email_idx`(`user_email`),
    INDEX `transactions_status_idx`(`status`),
    INDEX `transactions_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `role` ENUM('ADMIN', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `description` VARCHAR(255) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `nft_id` VARCHAR(100) NULL,
    `token_id` VARCHAR(100) NULL,
    `current_points` INTEGER NOT NULL DEFAULT 0,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `phone` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `points_adjustments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `points_before` INTEGER NOT NULL,
    `points_after` INTEGER NOT NULL,
    `delta` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `points_adjustments_user_id_idx`(`user_id`),
    INDEX `points_adjustments_admin_id_idx`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `points_adjustments` ADD CONSTRAINT `points_adjustments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `points_adjustments` ADD CONSTRAINT `points_adjustments_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
