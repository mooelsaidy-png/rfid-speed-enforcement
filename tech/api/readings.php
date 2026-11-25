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

$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
if ($limit < 1) $limit = 50;
if ($limit > 500) $limit = 500;

try {
    $sql = "SELECT
                lr.id, lr.session_id, lr.device_id, lr.zone_id, lr.tag_id,
                lr.peak_rssi_1, lr.peak_rssi_2, lr.rssi, lr.antenna_port,
                lr.speed_kmh, lr.time_diff_ms, lr.direction,
                lr.is_violation, lr.diagnostic_tag, lr.read_time,
                t.owner_name, t.vehicle_plate, t.vehicle_color, t.vehicle_type,
                sz.zone_name, sz.speed_limit,
                ed.location_name
            FROM live_readings lr
            LEFT JOIN tags t          ON lr.tag_id    = t.tag_id
            LEFT JOIN speed_zones sz  ON lr.zone_id   = sz.zone_id
            LEFT JOIN edge_devices ed ON lr.device_id = ed.device_id
            WHERE lr.device_id = ?
            ORDER BY lr.read_time DESC
            LIMIT ?";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(1, $deviceId, PDO::PARAM_STR);
    $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    $stmt->execute();
    echo json_encode($stmt->fetchAll());
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Query failed', 'detail' => $e->getMessage()]);
}
