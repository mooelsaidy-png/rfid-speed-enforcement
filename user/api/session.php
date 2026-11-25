<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if (empty($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['logged_in' => false]);
    exit;
}
echo json_encode(['logged_in' => true, 'user' => $_SESSION['user']]);
