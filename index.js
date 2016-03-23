(function(){
	var iceServers = [
		//{"urls": ["stun:stun.l.google.com:19302"]}
	];

	var peersByUser = {};
	var channels = [];

	var inputs = {};

	var userID = 'u' + makeID();
	var lastEventId = new Date().getTime() / 1000;

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

		graph.init("#graph");

		checkEvents();
		sendEvent({
			type: 'newUser',
			userID: userID,
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

			graph.addLink({source: data.userID, target: data.toUserID, type: data.sdp.type});

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
		if (window.EventSource) {
			var source = new EventSource('events.php?' + buildQuery({
				action: 'stream',
				lastEventId: lastEventId,
			}));
			source.onmessage = onEvent;
		} else {
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
	}

	function onEvent(e) {
		console.log(onEvent, e);

		var data = JSON.parse(e.data);
		var eventAction = data.type + 'Event';

		if (handles[eventAction])
			handles[eventAction](data);
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

	var graph = {
		nodes: [],
		links: [],

		width: 800,
		height: 380,

		force: null,
		svg: null,
		path: null,
		circle: null,
		text: null,

		tick() {
			graph.path.attr("d", graph.linkArc);
			graph.circle.attr("transform", graph.transform);
			graph.text.attr("transform", graph.transform);
		},

		linkArc(d) {
			var dx = d.target.x - d.source.x,
			dy = d.target.y - d.source.y,
			dr = Math.sqrt(dx * dx + dy * dy);
			return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
		},

		transform(d) {
			return "translate(" + d.x + "," + d.y + ")";
		},

		init(el) {
			graph.force = d3.layout.force()
				.nodes(graph.nodes)
				.links(graph.links)
				.size([graph.width, graph.height])
				.on("tick", graph.tick)
				.linkDistance(100)
				.charge(-300);

			graph.svg = d3.select(el).append("svg")
				.attr("width", graph.width)
				.attr("height", graph.height);

			graph.svg.append("defs").selectAll("marker")
				.data(["offer", "answer"])
				.enter().append("marker")
					.attr("id", d => d)
					.attr("viewBox", "0 -5 10 10")
					.attr("refX", 15)
					.attr("refY", -1.5)
					.attr("markerWidth", 6)
					.attr("markerHeight", 6)
					.attr("orient", "auto")
					.append("path")
						.attr("d", "M0,-5L10,0L0,5");

			graph.path = graph.svg.append("g").selectAll("path");
			graph.circle = graph.svg.append("g").selectAll("circle");
			graph.text = graph.svg.append("g").selectAll("text");
		},

		getNodeIndex(id) {
			for (var i = 0, len = graph.nodes.length; i < len; i += 1) {
				if (graph.nodes[i].id === id)
					return i;
			}
			return -1;
		},

		updateGraph() {
			graph.path = graph.path.data(graph.links);
			graph.circle = graph.circle.data(graph.nodes);
			graph.text = graph.text.data(graph.nodes);

			graph.path
				.enter().append("path")
					.attr("class", d => "link " + d.type)
					.attr("marker-end", d => "url(#" + d.type + ")");

			graph.circle
				.enter().append("circle")
					.attr("r", 6)
					.style("fill", d => d.id === userID ? '#093' : '#ccc')
					.call(graph.force.drag);

			graph.text
				.enter().append("text")
					.attr("x", 8)
					.attr("y", ".31em")
					.text(d => d.id);

			graph.path.exit().remove();
			graph.circle.exit().remove();
			graph.text.exit().remove();

			graph.force.start();
		},

		addLink(link) {
			if (!~graph.getNodeIndex(link.source))
				graph.nodes.push({id: link.source});

			if (!~graph.getNodeIndex(link.target))
				graph.nodes.push({id: link.target});

			link.source = graph.getNodeIndex(link.source);
			link.target = graph.getNodeIndex(link.target);
			graph.links.push(link);

			graph.updateGraph();
		},
	};

	window.addEventListener('load', startup, false);
})();
