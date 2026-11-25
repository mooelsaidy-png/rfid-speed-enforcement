<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once '../config/db.php';

$tag = isset($_GET['tag_id']) ? trim($_GET['tag_id']) : '';
$plate = isset($_GET['plate']) ? trim($_GET['plate']) : '';
if ($tag === '' && $plate === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Provide tag_id or plate']);
    exit;
}

try {
    // Find the tag (exact match on tag_id, optional LIKE on plate)
    if ($tag !== '') {
        $stmt = $pdo->prepare("SELECT * FROM tags WHERE tag_id = ? LIMIT 1");
        $stmt->execute([$tag]);
    } else {
        $stmt = $pdo->prepare("SELECT * FROM tags WHERE vehicle_plate LIKE ? LIMIT 1");
        $stmt->execute(['%' . $plate . '%']);
    }
    $tagRow = $stmt->fetch();

    if (!$tagRow) {
        http_response_code(404);
        echo json_encode(['error' => 'No matching tag found']);
        exit;
    }

    // All violations for this tag, with zone info
    $stmt = $pdo->prepare("
        SELECT v.id, v.violation_uid, v.zone_id, v.speed_kmh, v.speed_limit,
               v.over_by_kmh, v.direction, v.violation_type, v.severity,
               v.device_id, v.detected_at, v.sync_status,
               sz.zone_name, sz.speed_limit AS zone_limit
        FROM violations v
        LEFT JOIN speed_zones sz ON v.zone_id = sz.zone_id
        WHERE v.tag_id = ?
        ORDER BY v.detected_at DESC
    ");
    $stmt->execute([$tagRow['tag_id']]);
    $violations = $stmt->fetchAll();

    // All zones (for reference / limits)
    $zones = $pdo->query("SELECT zone_id, zone_name, speed_limit FROM speed_zones ORDER BY zone_id")->fetchAll();

    echo json_encode([
        'tag'        => $tagRow,
        'violations' => $violations,
        'zones'      => $zones
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Query failed', 'detail' => $e->getMessage()]);
}
