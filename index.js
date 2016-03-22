(function(){
	var userID = 'u' + makeID();

	var iceServers = [
		//{"urls": ["stun:stun.l.google.com:19302"]}
	];

	var peersByID = {};
	var peersByUser = {};
	var channels = [];

	var inputs = {};

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
		createOfferButton: function() {
			var peerID = 'p' + makeID();
			var peer = createPeer(peerID);

			addChannel(peer.createDataChannel('sendChannel'));
				
			peer.createOffer()
				.then(offer => {
					console.log('createOffer', offer);
					peer.setLocalDescription(offer);
				})
				.catch(e => console.log('Unable to create an offer: ' + e.toString()));

			getJson('getOffer.php', {
				userID: userID,
			}).then(onSignal);

			getJson('getAnswer.php', {
				userID: userID,
				peerID: peerID,
			}).then(onSignal);
		},

		getOfferButton: function() {
			getJson('getOffer.php', {
				userID: userID,
			}).then(onSignal);
		},

		getAnswerButton: function() {
			for (var peerID in peersByID) {
				console.log('getAnswer', peersByID[peerID]);

				//if (peersByID[peerID].iceConnectionState !== 'new')
				if (peersByID[peerID].signalingState !== 'have-local-offer')
					continue;

				getJson('getAnswer.php', {
					userID: userID,
					peerID: peerID,
				}).then(onSignal);
			}
		},

		sendButton: function() {
			console.log('sendHandle', inputs.messageBox.value);
			sendMessage(inputs.messageBox.value);
			inputs.messageBox.value = "";
		}
	};

	function makeID() {
		//return new Date().getTime();
		//return (Math.floor(Math.random() * 0xefff) + 0x1000).toString(16);
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
			fd.set(key, data[key]);
		}

		return fd;
	}

	function getJson(url, data) {
		return fetch(url + '?' + buildQuery(data)).then(response => response.json());
	}

	function postJson(url, data) {
		return fetch(url, {method: 'post', body: buildData(data)}).then(response => response.json());
	}

	function createPeer(peerID) {
		var peer = new RTCPeerConnection({
			'iceServers': iceServers
		});

		peer.onsignalingstatechange = e => console.log('onSignalingStateChange', e.target.signalingState);
		peer.oniceconnectionstatechange = e => console.log('onIceConnectionStateChange', e.target.iceConnectionState, 'iceGatheringState', e.target.iceGatheringState);
		peer.onnegotiationneeded = e => console.log('onNegotiationNeeded');

		peer.ondatachannel = e => {
			console.log('onDataChannel', e.channel);
			addChannel(e.channel);
		};

		peer.onicecandidate = e => {
			console.log('onIceCandidate', e.candidate);
			if (!e.candidate) {
				sendSignal({
					peerID: peerID,
					sdp: peer.localDescription
				});
			}
		};

		peersByID[peerID] = peer;

		return peer;
	}

	function sendSignal(signal) {
		console.log('sendSignal', signal);
		
		postJson('createPeer.php', {
			userID: userID,
			peerID: signal.peerID,
			sdp: JSON.stringify(signal.sdp),
		});
	}

	function onSignal(signal) {
		console.log('onSignal', signal);

		if (!signal.sdp)
			return;

		if (signal.sdp.type === 'offer')
			createPeer(signal.peerID);

		var peer = peersByID[signal.peerID];

		peer.setRemoteDescription(new RTCSessionDescription(signal.sdp))
			.then(() => {
				if (peer.remoteDescription.type === 'offer') {
					peer.createAnswer()
						.then(anwser => {
							console.log('createAnswer', anwser);
							peer.setLocalDescription(anwser);
						});
				}
			});
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
		console.log('channelMessageHandle', e);
		showMessage('other', e.data);
	}

	function channelStatusHandle(e) {
		console.log('channelStatusHandle', e.target.readyState);
		showMessage('channel', e.target.readyState);

		if (e.target.readyState === 'closed') {
			//channels = channels.filter(c => c !== e.target);
			channels.splice(channels.indexOf(e.target), 1);
		}
	}
	
	window.addEventListener('load', startup, false);
})();
