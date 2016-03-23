<?php

class Events
{
	public function send()
	{
		$data = $_REQUEST['data'];
		$id = microtime(true);

		file_put_contents('events/'.$id, $data);

		echo json_encode([
			'id' => $id,
		]);
	}

	public function check()
	{
		$lastEventId = $_REQUEST['lastEventId'];

		$events = [];

		while (true) {
			foreach (glob('events/*') as $filename) {
				$id = basename($filename);

				if ($id > $lastEventId) {
					$data = file_get_contents($filename);

					$events[] = [
						'id' => $id,
						'data' => $data,
					];
				}
			}

			if (!empty($events))
				break;

			sleep(1);
		}

		$lastEvent = end($events);

		echo json_encode([
			'lastEventId' => $lastEvent['id'],
			'events' => $events,
		]);
	}

	public function stream()
	{
		header('Content-Type: text/event-stream');
		header('Cache-Control: no-cache');

		$lastEventId = $_REQUEST['lastEventId'];

		$headers = apache_request_headers();
		if (!empty($headers['Last-Event-ID']))
			$lastEventId = $headers['Last-Event-ID'];

		while (true) {
			foreach (glob('events/*') as $filename) {
				$id = basename($filename);

				if ($id > $lastEventId) {
					$data = file_get_contents($filename);
					
					echo "id: $id" . PHP_EOL;
					echo "data: $data" . PHP_EOL;
					echo PHP_EOL;
					ob_flush();
					flush();

					$lastEventId = $id;
				}
			}

			sleep(1);
		}
	}
}

$events = new Events;
$action = $_REQUEST['action'];
$events->$action();
