<?php

$peerID = $_GET['peerID'];
$filename = 'data/'.$peerID.'_answer.json';

while (!file_exists($filename)) {
	sleep(1);
}

$sdpJson = file_get_contents($filename);
$sdp = json_decode($sdpJson);

unlink($filename);

echo json_encode(['peerID' => $peerID, 'sdp' => $sdp]);