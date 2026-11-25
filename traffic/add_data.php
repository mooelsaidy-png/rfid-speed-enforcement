<?php
/**
 * add_data.php — bridge between ESP32 firmware and the rfid_system database.
 *
 * The ESP32 POSTs:
 *   tag_id=F4:C7:14:07
 *   speed=12.50
 *   delta_time=1.4400
 *   violation=1
 *
 * The URL carries the location context:
 *   ?device=EDGE-001&zone=5
 *
 * Behaviour:
 *   1. Validate input.
 *   2. Look up tag (must exist in `tags`).
 *   3. Look up zone limit (must exist in `speed_zones`).
 *   4. Recompute violation server-side (do NOT trust the device flag).
 *   5. Insert into `live_readings` (always).
 *   6. Insert into `violations` (only if violation).
 *   7. Touch `edge_devices.last_seen_at` / is_online.
 *   8. Return JSON so the ESP32 Serial Monitor shows what happened.
 */

header('Content-Type: application/json; charset=utf-8');

// Path to your existing config/db.php — adjust if your folder layout differs.
// In this project, config/db.php sits two levels up from the web root,
// e.g.  C:\xampp\htdocs\config\db.php   when add_data.php is at
//       C:\xampp\htdocs\traffic\add_data.php
require_once __DIR__ . '/config/db.php';

// ---- Location context (from the URL the ESP32 hit) ------------------------
$deviceId = isset($_GET['device']) ? trim($_GET['device']) : '';
$zoneId   = isset($_GET['zone'])   ? (int)$_GET['zone']     : 0;

if ($deviceId === '' || $zoneId <= 0) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Missing device/zone in URL',
        'hint'  => 'Use ?device=EDGE-001&zone=5 in SERVER_URL',
    ]);
    exit;
}

// ---- Payload from ESP32 ---------------------------------------------------
$tagId    = isset($_POST['tag_id'])     ? trim($_POST['tag_id'])   : '';
$speedKmh = isset($_POST['speed'])      ? (float)$_POST['speed']   : 0.0;
$deltaSec = isset($_POST['delta_time']) ? (float)$_POST['delta_time'] : 0.0;
$devFlag  = isset($_POST['violation'])  ? (int)$_POST['violation'] : 0;  // logged, not trusted

if ($tagId === '' || $speedKmh <= 0.0) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing tag_id or speed', 'got' => [
        'tag_id' => $tagId, 'speed' => $speedKmh,
    ]]);
    exit;
}

try {
    // ---- 1) Tag must exist ------------------------------------------------
    $stmt = $pdo->prepare("SELECT * FROM tags WHERE tag_id = ? LIMIT 1");
    $stmt->execute([$tagId]);
    $tagRow = $stmt->fetch();
    if (!$tagRow) {
        http_response_code(404);
        echo json_encode([
            'error'  => 'Unknown tag',
            'tag_id' => $tagId,
            'hint'   => "INSERT INTO tags (tag_id, owner_name, vehicle_plate, vehicle_color, vehicle_type) VALUES ('$tagId', '...', '...', '...', '...');",
        ]);
        exit;
    }

    // ---- 2) Zone must exist ----------------------------------------------
    $stmt = $pdo->prepare("SELECT zone_name, speed_limit FROM speed_zones WHERE zone_id = ?");
    $stmt->execute([$zoneId]);
    $zoneRow = $stmt->fetch();
    if (!$zoneRow) {
        http_response_code(404);
        echo json_encode([
            'error'  => 'Unknown zone',
            'zone_id' => $zoneId,
            'hint'   => 'Add a row to speed_zones or change ?zone= in SERVER_URL',
        ]);
        exit;
    }
    $limit  = (float)$zoneRow['speed_limit'];
    $overBy = round($speedKmh - $limit, 2);
    $isViolServer = ($overBy > 0.0) ? 1 : 0;

    // ---- 3) Build unique keys --------------------------------------------
    $sessionId = bin2hex(random_bytes(16));                 // UNIQUE in live_readings
    $now       = date('Y-m-d H:i:s');

    $pdo->beginTransaction();

    // ---- 4) live_readings ------------------------------------------------
    $pdo->prepare("
        INSERT INTO live_readings
            (session_id, device_id, zone_id, tag_id,
             speed_kmh, time_diff_ms, direction, is_violation,
             read_time, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([
        $sessionId,
        $deviceId,
        $zoneId,
        $tagId,
        $speedKmh,
        (int)round($deltaSec * 1000),
        'North',
        $isViolServer,
        $now,
        $now,
    ]);

    // ---- 5) violations (only if violation) ------------------------------
    $violationUid = null;
    if ($isViolServer === 1) {
        $violationUid = 'VIO-' . date('YmdHis') . '-' . substr($sessionId, 0, 6);

        if ($overBy >= 20.0)      $severity = 'High';
        elseif ($overBy >= 10.0)  $severity = 'Medium';
        else                      $severity = 'Low';

        $pdo->prepare("
            INSERT INTO violations
                (violation_uid, session_id, tag_id, vehicle_plate, zone_id,
                 speed_kmh, speed_limit, over_by_kmh, direction, violation_type,
                 severity, device_id, detected_at, transmitted_at, sync_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $violationUid,
            $sessionId,
            $tagId,
            $tagRow['vehicle_plate'],
            $zoneId,
            $speedKmh,
            $limit,
            $overBy,
            'North',
            'Speeding',
            $severity,
            $deviceId,
            $now,
            $now,
            'received',
        ]);
    }

    // ---- 6) Device heartbeat --------------------------------------------
    $pdo->prepare("
        UPDATE edge_devices
           SET last_seen_at = ?, is_online = TRUE
         WHERE device_id = ?
    ")->execute([$now, $deviceId]);

    $pdo->commit();

    // ---- 7) Success JSON ------------------------------------------------
    echo json_encode([
        'ok'             => true,
        'session_id'     => $sessionId,
        'violation_uid'  => $violationUid,
        'device_id'      => $deviceId,
        'zone_id'        => $zoneId,
        'zone_name'      => $zoneRow['zone_name'],
        'tag_id'         => $tagId,
        'owner_name'     => $tagRow['owner_name'],
        'vehicle_plate'  => $tagRow['vehicle_plate'],
        'speed_kmh'      => $speedKmh,
        'speed_limit'    => $limit,
        'over_by_kmh'    => $overBy,
        'is_violation'   => $isViolServer,
        'device_flag'    => $devFlag,   // echoed for debugging only
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'error'  => 'Insert failed',
        'detail' => $e->getMessage(),
    ]);
}