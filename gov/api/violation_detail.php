<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once '../config/db.php';

$vid = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($vid <= 0) { http_response_code(400); echo json_encode(['error' => 'Missing id']); exit; }

try {
    $stmt = $pdo->prepare("
        SELECT v.*, sz.zone_name, sz.speed_limit AS zone_limit,
               ed.location_name,
               t.owner_name, t.vehicle_plate AS tag_plate, t.vehicle_color, t.vehicle_type,
               gr.ack_reference, gr.reported_at
        FROM violations v
        LEFT JOIN speed_zones sz  ON v.zone_id = sz.zone_id
        LEFT JOIN edge_devices ed ON v.device_id = ed.device_id
        LEFT JOIN tags t          ON v.tag_id = t.tag_id
        LEFT JOIN government_report gr ON gr.violation_id = v.id
        WHERE v.id = ?
    ");
    $stmt->execute([$vid]);
    $row = $stmt->fetch();
    if (!$row) { http_response_code(404); echo json_encode(['error' => 'Violation not found']); exit; }
    echo json_encode($row);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Query failed', 'detail' => $e->getMessage()]);
}
