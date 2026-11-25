<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once '../config/db.php';

$zoneId = isset($_GET['zone']) ? intval($_GET['zone']) : 0;
if ($zoneId <= 0) { http_response_code(400); echo json_encode(['error' => 'Missing zone']); exit; }

$source = $_GET['source'] ?? 'reported'; // 'reported' | 'all'

try {
    if ($source === 'all') {
        $sql = "SELECT v.id, v.violation_uid, v.vehicle_plate, v.tag_id, v.zone_id,
                       v.speed_kmh, v.speed_limit, v.over_by_kmh, v.direction,
                       v.violation_type, v.severity, v.device_id, v.detected_at,
                       v.sync_status, sz.zone_name
                FROM violations v
                LEFT JOIN speed_zones sz ON v.zone_id = sz.zone_id
                WHERE v.zone_id = ?
                ORDER BY v.detected_at DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$zoneId]);
    } else {
        $sql = "SELECT v.id, v.violation_uid, v.vehicle_plate, v.tag_id, v.zone_id,
                       v.speed_kmh, v.speed_limit, v.over_by_kmh, v.direction,
                       v.violation_type, v.severity, v.device_id, v.detected_at,
                       v.sync_status, sz.zone_name,
                       gr.ack_reference, gr.reported_at
                FROM government_report gr
                JOIN violations v ON gr.violation_id = v.id
                LEFT JOIN speed_zones sz ON v.zone_id = sz.zone_id
                WHERE v.zone_id = ?
                ORDER BY gr.reported_at DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$zoneId]);
    }
    echo json_encode($stmt->fetchAll());
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Query failed', 'detail' => $e->getMessage()]);
}
