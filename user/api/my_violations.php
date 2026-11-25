<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once '../config/db.php';

if (empty($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in']);
    exit;
}

$tagId = $_SESSION['user']['tag_id'];

try {
    $stmt = $pdo->prepare("
        SELECT v.id, v.violation_uid, v.speed_kmh, v.speed_limit, v.over_by_kmh,
               v.direction, v.violation_type, v.severity, v.detected_at,
               sz.zone_name, sz.speed_limit AS zone_limit
        FROM violations v
        LEFT JOIN speed_zones sz ON v.zone_id = sz.zone_id
        WHERE v.tag_id = ?
        ORDER BY v.detected_at DESC
    ");
    $stmt->execute([$tagId]);
    $rows = $stmt->fetchAll();

    $total = count($rows);
    $worst = 'None';
    $sumOver = 0;
    foreach ($rows as $r) {
        $sumOver += max(0, (float)$r['over_by_kmh']);
        if ($r['severity'] === 'High')        $worst = 'High';
        elseif ($r['severity'] === 'Medium' && $worst !== 'High') $worst = 'Medium';
        elseif ($r['severity'] === 'Low' && $worst === 'None')    $worst = 'Low';
    }

    echo json_encode([
        'user'       => $_SESSION['user'],
        'violations' => $rows,
        'summary'    => [
            'total'    => $total,
            'worst'    => $worst,
            'sum_over' => round($sumOver, 2)
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Query failed', 'detail' => $e->getMessage()]);
}
