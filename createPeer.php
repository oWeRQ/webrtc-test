<?php

$peerID = $_POST['peerID'];

$sdpJson = $_POST['sdp'];
$sdp = json_decode($sdpJson);

$filename = 'data/'.$peerID.'_'.$sdp->type.'.json';

file_put_contents($filename, $sdpJson);
