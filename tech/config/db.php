<?php
$host     = 'sql7.freesqldatabase.com';
$dbname   = 'sql7841489';
$username = 'sql7841489';
$password = 'Peg9qAZRYe';


try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username, $password,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'DB connection failed', 'detail' => $e->getMessage()]);
    error_log('DB Error: ' . $e->getMessage());
    exit;
}
