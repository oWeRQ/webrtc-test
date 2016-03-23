(function(){
	var iceServers = [
		//{"urls": ["stun:stun.l.google.com:19302"]}
	];

	var peersByUser = {};
	var channels = [];

	var inputs = {};

	var userID = 'u' + makeID();
	var lastEventId = new Date().getTime() / 1000;

	checkEvents();
	sendEvent({
		type: 'newUser',
		userID: userID,
	});

	function startup() {
		//for (let input of document.querySelectorAll('input, textarea, select')) {
		[].slice.call(document.querySelectorAll('input, textarea, select')).forEach(input => {
			input.value = '';
			inputs[input.name] = input;
		});

		//for (let button of document.querySelectorAll('button')) {
		[].slice.call(document.querySelectorAll('button')).forEach(button => {
			button.addEventListener('click', handles[button.name], false);
		});
	}

	var handles = {
		sendButton: function() {
			console.log(handles.sendButton, inputs.messageBox.value);
			sendMessage(inputs.messageBox.value);
			inputs.messageBox.value = "";
		},

		newUserEvent: function(data) {
			console.log(handles.newUserEvent, data);

			if (data.userID === userID)
				return;

			var peer = createPeer(peer => {
				sendEvent({
					'type': 'connectUser',
					'userID': userID,
					'toUserID': data.userID,
					'sdp': peer.localDescription,
				});
			});

			peersByUser[data.userID] = peer;

			addChannel(peer.createDataChannel('sendChannel'));
				
			peer.createOffer()
				.then(offer => {
					console.log(peer.createOffer, offer);
					peer.setLocalDescription(offer);
				})
				.catch(e => console.log('Unable to create an offer: ' + e.toString()));
		},

		connectUserEvent: function(data) {
			console.log(handles.connectUserEvent, data);

			if (!data.sdp || data.toUserID !== userID)
				return;

			if (data.sdp.type === 'offer') {
				peersByUser[data.userID] = createPeer(peer => {
					sendEvent({
						'type': 'connectUser',
						'userID': userID,
						'toUserID': data.userID,
						'sdp': peer.localDescription,
					});
				});
			}

			var peer = peersByUser[data.userID];

			peer.setRemoteDescription(new RTCSessionDescription(data.sdp))
				.then(() => {
					if (peer.remoteDescription.type === 'offer') {
						peer.createAnswer()
							.then(anwser => {
								console.log(peer.createAnswer, anwser);
								peer.setLocalDescription(anwser);
							});
					}
				});
		}
	};

	function makeID() {
		return Math.floor(Math.random() * 9000) + 1000;
	}

	function buildQuery(data) {
		var query = [];

		for (var key in data) {
			query.push(encodeURIComponent(key) + "=" + encodeURIComponent(data[key]));
		}

		return query.join('&');
	}

	function buildData(data) {
		var fd = new FormData();

		for (var key in data) {
			fd.append(key, data[key]);
		}

		return fd;
	}

	function getJson(url, data) {
		return fetch(url + '?' + buildQuery(data)).then(response => response.json());
	}

	function postJson(url, data) {
		return fetch(url, {method: 'post', body: buildData(data)}).then(response => response.json());
	}

	function sendEvent(data) {
		postJson('events.php', {
			action: 'send',
			data: JSON.stringify(data)
		}).then(data => console.log(sendEvent, data));
	}

	function checkEvents() {
		postJson('events.php', {
			action: 'check',
			lastEventId: lastEventId
		}).then(data => {
			lastEventId = data.lastEventId;
			data.events.forEach(onEvent);
			setTimeout(checkEvents, 1);
		}).catch(e => {
			console.log(checkEvents, e);
			setTimeout(checkEvents, 1);
		});
	}

	function onEvent(e) {
		console.log(onEvent, e);

		var eventAction = e.data.type + 'Event';

		if (handles[eventAction])
			handles[eventAction](e.data);
	}

	function createPeer(onReady) {
		var peer = new RTCPeerConnection({
			'iceServers': iceServers
		});

		peer.onsignalingstatechange = e => console.log(peer.onsignalingstatechange, e.target.signalingState);
		peer.oniceconnectionstatechange = e => console.log(peer.oniceconnectionstatechange, e.target.iceConnectionState, 'iceGatheringState', e.target.iceGatheringState);
		peer.onnegotiationneeded = e => console.log(peer.onnegotiationneeded);

		peer.ondatachannel = e => {
			console.log(peer.ondatachannel, e.channel);
			addChannel(e.channel);
		};

		peer.onicecandidate = e => {
			console.log(peer.onicecandidate, e.candidate);
			if (!e.candidate) {
				onReady(peer);
			}
		};

		return peer;
	}

	function showMessage(from, message) {
		var time = new Date().toTimeString().substr(0, 8);
		inputs.receiveBox.value += time + ' ' + from + ': ' + message + '\n';
	}

	function sendMessage(message) {
		for (var i = 0; i < channels.length; i++) {
			if (channels[i].readyState === 'open')
				channels[i].send(message);
		}

		showMessage('me', message);
	}

	function addChannel(channel) {
		channel.onmessage = channelMessageHandle;
		channel.onopen = channelStatusHandle;
		channel.onclose = channelStatusHandle;
		channels.push(channel);
	}

	function channelMessageHandle(e) {
		console.log(channelMessageHandle, e);
		showMessage('other', e.data);
	}

	function channelStatusHandle(e) {
		console.log(channelStatusHandle, e.target.readyState);
		showMessage('channel', e.target.readyState);

		if (e.target.readyState === 'closed') {
			//channels = channels.filter(c => c !== e.target);
			channels.splice(channels.indexOf(e.target), 1);
		}
	}
	
	window.addEventListener('load', startup, false);
})();
