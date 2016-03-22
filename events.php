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
					$events[] = [
						'id' => $id,
						'data' => json_decode(file_get_contents($filename), true),
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
}

$events = new Events;
$action = $_REQUEST['action'];
$events->$action();
