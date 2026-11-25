-- ============================================
-- RFID System — Option A schema (IDEMPOTENT)
-- Safe to re-run. Drops in FK-safe order first.
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `government_report`;
DROP TABLE IF EXISTS `violations`;
DROP TABLE IF EXISTS `live_readings`;
DROP TABLE IF EXISTS `edge_devices`;
DROP TABLE IF EXISTS `speed_zones`;
DROP TABLE IF EXISTS `tags`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `tags` (
  `tag_id` varchar(64) PRIMARY KEY COMMENT 'RFID tag UID',
  `owner_name` varchar(100),
  `vehicle_plate` varchar(20),
  `vehicle_color` varchar(30),
  `vehicle_type` varchar(50),
  `created_at` timestamp DEFAULT (now())
);

CREATE TABLE `speed_zones` (
  `zone_id` int PRIMARY KEY AUTO_INCREMENT,
  `zone_name` varchar(100),
  `speed_limit` decimal(6,2) COMMENT 'km/h',
  `is_active` boolean DEFAULT true,
  `created_at` timestamp DEFAULT (now())
);

CREATE TABLE `edge_devices` (
  `device_id` varchar(64) PRIMARY KEY,
  `location_name` varchar(100),
  `zone_id` int,
  `edition` varchar(10) DEFAULT 'A' COMMENT 'A | B',
  `last_seen_at` datetime(3),
  `last_heartbeat_batch` bigint,
  `firmware_ver` varchar(20),
  `buffer_backlog` int,
  `is_online` boolean DEFAULT false,
  `created_at` timestamp DEFAULT (now())
);

CREATE TABLE `live_readings` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `session_id` varchar(64) UNIQUE COMMENT 'One row per pass (edge UUID)',
  `device_id` varchar(64),
  `zone_id` int,
  `tag_id` varchar(64),
  `peak_rssi_1` int,
  `peak_rssi_2` int,
  `rssi` int,
  `antenna_port` int,
  `speed_kmh` decimal(6,2),
  `time_diff_ms` int,
  `direction` varchar(20),
  `is_violation` boolean DEFAULT false,
  `diagnostic_tag` varchar(50),
  `read_time` datetime(3),
  `received_at` datetime(3),
  `created_at` timestamp DEFAULT (now())
);

CREATE TABLE `violations` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `violation_uid` varchar(64) UNIQUE COMMENT 'Idempotency key',
  `session_id` varchar(64),
  `tag_id` varchar(64),
  `vehicle_plate` varchar(20),
  `zone_id` int,
  `speed_kmh` decimal(6,2) NOT NULL,
  `speed_limit` decimal(6,2),
  `over_by_kmh` decimal(6,2),
  `direction` varchar(20),
  `violation_type` varchar(50),
  `severity` varchar(20),
  `device_id` varchar(64),
  `detected_at` datetime(3),
  `transmitted_at` datetime(3),
  `sync_status` varchar(20) DEFAULT 'received',
  `created_at` timestamp DEFAULT (now())
);

CREATE TABLE `government_report` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `violation_id` int,
  `violation_uid` varchar(64),
  `tag_id` varchar(64),
  `speed_kmh` decimal(6,2),
  `violation_type` varchar(50),
  `reported_at` datetime,
  `ack_reference` varchar(100),
  `created_at` timestamp DEFAULT (now())
);

CREATE INDEX `live_readings_index_0` ON `live_readings` (`device_id`, `read_time`);
CREATE INDEX `live_readings_index_1` ON `live_readings` (`device_id`, `is_violation`);
CREATE INDEX `live_readings_index_2` ON `live_readings` (`tag_id`);
CREATE INDEX `violations_index_3` ON `violations` (`zone_id`, `detected_at`);
CREATE INDEX `violations_index_4` ON `violations` (`violation_type`, `detected_at`);
CREATE INDEX `violations_index_5` ON `violations` (`tag_id`);
CREATE INDEX `violations_index_6` ON `violations` (`device_id`);

ALTER TABLE `edge_devices` ADD FOREIGN KEY (`zone_id`) REFERENCES `speed_zones` (`zone_id`);
ALTER TABLE `live_readings` ADD FOREIGN KEY (`device_id`) REFERENCES `edge_devices` (`device_id`);
ALTER TABLE `live_readings` ADD FOREIGN KEY (`zone_id`) REFERENCES `speed_zones` (`zone_id`);
ALTER TABLE `live_readings` ADD FOREIGN KEY (`tag_id`) REFERENCES `tags` (`tag_id`);
ALTER TABLE `violations` ADD FOREIGN KEY (`session_id`) REFERENCES `live_readings` (`session_id`);
ALTER TABLE `violations` ADD FOREIGN KEY (`tag_id`) REFERENCES `tags` (`tag_id`);
ALTER TABLE `violations` ADD FOREIGN KEY (`zone_id`) REFERENCES `speed_zones` (`zone_id`);
ALTER TABLE `violations` ADD FOREIGN KEY (`device_id`) REFERENCES `edge_devices` (`device_id`);
ALTER TABLE `government_report` ADD FOREIGN KEY (`violation_id`) REFERENCES `violations` (`id`);
