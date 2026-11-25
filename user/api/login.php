<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once '../config/db.php';

$identifier = isset($_POST['identifier']) ? trim($_POST['identifier']) : '';
$password   = isset($_POST['password'])   ? trim($_POST['password'])   : '';

if ($identifier === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing identifier or password']);
    exit;
}

try {
    // Password IS the tag_id. Identifier matches owner_name OR vehicle_plate.
    // utf8mb4_unicode_ci collation => case-insensitive automatically.
    $stmt = $pdo->prepare("
        SELECT tag_id, owner_name, vehicle_plate, vehicle_color, vehicle_type
        FROM tags
        WHERE (owner_name = ? OR vehicle_plate = ?) AND tag_id = ?
        LIMIT 1
    ");
    $stmt->execute([$identifier, $identifier, $password]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        exit;
    }

    session_regenerate_id(true);
    $_SESSION['user'] = $user;
    echo json_encode(['ok' => true, 'user' => $user]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Login failed', 'detail' => $e->getMessage()]);
}
