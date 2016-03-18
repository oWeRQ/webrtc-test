<?php

$offers = glob('data/*_offer.json');
$filename = $offers[0];
$peerID = reset(explode('_', basename($filename)));

$sdpJson = file_get_contents($filename);
$sdp = json_decode($sdpJson);

unlink($filename);

echo json_encode(['peerID' => $peerID, 'sdp' => $sdp]);