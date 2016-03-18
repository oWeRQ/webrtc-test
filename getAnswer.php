<?php

$peerID = $_GET['peerID'];
$filename = 'data/'.$peerID.'_answer.json';

$sdpJson = file_get_contents($filename);
$sdp = json_decode($sdpJson);

unlink($filename);

echo json_encode(['peerID' => $peerID, 'sdp' => $sdp]);