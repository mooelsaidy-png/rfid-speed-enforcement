<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once '../config/db.php';

try {
    $stmt = $pdo->query("
        SELECT sz.zone_id, sz.zone_name, sz.speed_limit, sz.is_active,
               (SELECT COUNT(*) FROM government_report gr
                 JOIN violations v ON gr.violation_id = v.id
                 WHERE v.zone_id = sz.zone_id) AS reported_count,
               (SELECT COUNT(*) FROM violations v WHERE v.zone_id = sz.zone_id) AS total_count
        FROM speed_zones sz
        ORDER BY sz.zone_id
    ");
    echo json_encode($stmt->fetchAll());
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Query failed', 'detail' => $e->getMessage()]);
}
