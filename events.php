<?php

class Events
{
	protected $storageDir = 'events/';

	public function send()
	{
		$this->cleanupEvents();

		$id = $this->addEvent($_REQUEST['data']);

		echo json_encode([
			'id' => $id,
		]);
	}

	public function check()
	{
		if (!empty($_REQUEST['lastEventId']))
			$lastEventId = $_REQUEST['lastEventId'];
		else
			$lastEventId = $this->getLastEventId();

		while (true) {
			if ($events = $this->checkEvents($lastEventId)) {
				$lastEvent = end($events);

				echo json_encode([
					'lastEventId' => $lastEvent['id'],
					'events' => $events,
				]);

				exit();
			}

			usleep(250);
		}
	}

	public function stream()
	{
		header('Content-Type: text/event-stream');
		header('Cache-Control: no-cache');

		echo 'retry: 10000'.PHP_EOL.PHP_EOL;

		$headers = apache_request_headers();
		if (!empty($headers['Last-Event-ID']))
			$lastEventId = $headers['Last-Event-ID'];
		else
			$lastEventId = $this->getLastEventId();

		while (true) {
			foreach ($this->checkEvents($lastEventId) as $event) {
				$this->streamSend($event);
				$lastEventId = $event['id'];
			}

			usleep(250);
		}
	}

	protected function streamSend($data)
	{
		foreach ($data as $key => $value) {
			foreach (explode("\n", $value) as $line) {
				echo $key.': '.$line;
			}

			echo PHP_EOL;
		}

		echo PHP_EOL;
		ob_flush();
		flush();
	}

	protected function getLastEventId()
	{
		return microtime(true);
	}

	protected function addEvent($data)
	{
		$id = microtime(true);
		file_put_contents($this->storageDir.$id, $data);
		return $id;
	}

	protected function checkEvents($lastEventId)
	{
		clearstatcache(true, $this->storageDir);
		if (filemtime($this->storageDir) < floor($lastEventId))
			return [];

		$events = [];

		foreach (scandir($this->storageDir) as $id) {
			if ($id <= $lastEventId)
				continue;

			$events[] = [
				'id' => $id,
				'data' => file_get_contents($this->storageDir.$id),
			];
		}

		return $events;
	}

	protected function cleanupEvents($maxAge = 60)
	{
		$minTime = time() - $maxAge;

		foreach (scandir($this->storageDir) as $id) {
			if ($id < $minTime) {
				unlink($this->storageDir.$id);
			}
		}
	}
}

$events = new Events;
$action = $_REQUEST['action'];
$events->$action();
