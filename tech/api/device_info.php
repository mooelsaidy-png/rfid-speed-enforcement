<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once '../config/db.php';

$deviceId = isset($_GET['device']) ? trim($_GET['device']) : '';
if ($deviceId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing device parameter']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT ed.device_id, ed.location_name, ed.zone_id, ed.edition,
               ed.firmware_ver, ed.buffer_backlog, ed.is_online,
               ed.last_seen_at, ed.last_heartbeat_batch,
               sz.zone_name, sz.speed_limit, sz.is_active
        FROM edge_devices ed
        LEFT JOIN speed_zones sz ON ed.zone_id = sz.zone_id
        WHERE ed.device_id = ?
    ");
    $stmt->execute([$deviceId]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Device not found']);
        exit;
    }
    echo json_encode($row);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Query failed', 'detail' => $e->getMessage()]);
}
