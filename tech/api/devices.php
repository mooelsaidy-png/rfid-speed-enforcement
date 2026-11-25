<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once '../config/db.php';

try {
    $stmt = $pdo->query("
        SELECT ed.device_id, ed.location_name, ed.zone_id, ed.edition,
               ed.firmware_ver, ed.buffer_backlog, ed.is_online,
               ed.last_seen_at, ed.last_heartbeat_batch,
               sz.zone_name, sz.speed_limit
        FROM edge_devices ed
        LEFT JOIN speed_zones sz ON ed.zone_id = sz.zone_id
        ORDER BY ed.device_id
    ");
    echo json_encode($stmt->fetchAll());
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Query failed', 'detail' => $e->getMessage()]);
}
