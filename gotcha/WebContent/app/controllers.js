// Main application controller
gotcha.controller('mainController', ['$scope', '$rootScope', '$location', '$http', '$filter', 'animationService', function($scope, $rootScope, $location, $http, $filter, animationService) {
	
	$rootScope.route = "login";

	$http({
		method: 'POST',
		url: 'welcome',
		headers: {'Content-Type' : "application/json; charset=utf-8"},
		data: {}
	}).then(
		function (success) {
			$rootScope.route = success.data.route;
			$rootScope.user = success.data.user;
			if (success.data.user !== undefined) {
				$rootScope.user.lastSeen = $filter('date')(Date.now(), "MMM dd,yyyy HH:mm:ss");
			}
			$rootScope.channels = success.data.channels;
			$rootScope.directMessages = success.data.directMessages;
		},
		function (failure) {
			console.log(failure.data);
		}
	);

	$rootScope.$watch(function () {
		return $rootScope.route;
	}, function (newValue, oldValue) {
		$scope.templateUrl = "app/views/" + newValue + ".html";
		$location.path(newValue);
	});
}])
// Login controller that uses 'restService' for restful call
.controller('loginController', ['$scope', '$rootScope', '$timeout', '$http', 'messagingService', 'notifyService', 'animationService', function($scope, $rootScope, $timeout, $http, messagingService, notifyService, animationService) {
	
	$scope.login = function () {
		var user = {
			"username": $scope.username,
			"password": $scope.password
		};

		$http({
			method: 'POST',
			url: 'login/auth',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: user
		}).then(
			function (success) {
				var data = success.data;
				notifyService.alert({
					"status": data.status,
					"selector": data.notification.selector,
					"message": data.notification.message
				});
				if (data.status == "success") {
					$timeout(function () {
						$rootScope.route = data.route;
						$rootScope.user = data.user;
						$rootScope.channels = data.channels;
						$rootScope.directMessages = data.directMessages;
					}, 2500);
				}
			},
			function (failure) {
				console.log(failure.data);
			}
		);
	};
}])

.controller('registerController', ['$scope', '$rootScope', '$timeout', '$http', '$filter', 'messagingService', 'notifyService', 'animationService', function($scope, $rootScope, $timeout, $http, $filter, messagingService, notifyService, animationService) {
	// Scope variables
	$scope.disabled = true;

	// Scope methods
	$scope.checkButton = function () {
		$scope.disabled = 
			$scope.validUsername != "glyphicon glyphicon-ok-circle" || $scope.validNickname != "glyphicon glyphicon-ok-circle"
			||
			$scope.username == "" || $scope.nickname == "" ||	$scope.password == ""
			||
			$scope.username == undefined || $scope.nickname == undefined ||	$scope.password == undefined;
	};

	$scope.register = function () {
		var user = {
			"username": $scope.username,
			"password": $scope.password,
			"nickName": $scope.nickname,
			"description": $scope.description,
			"photoUrl": $scope.photoUrl !== undefined ? $scope.photoUrl : "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcSMyKQ_ZaKgbgQ6PE--NyftpawhbFDuv0lIZAslbH_o5QVS3KY9wHo87AqxyQ",
			"status" : "active",
			"signedUp": $filter('date')(Date.now(), "MMM dd,yyyy HH:mm:ss"),
			"lastSeen": $filter('date')(Date.now(), "MMM dd,yyyy HH:mm:ss")
		};

		$http({
			method: 'POST',
			url: 'register',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: user
		}).then(
			function (success) {
				var data = success.data;
				notifyService.alert({
					"status": data.status,
					"selector": data.notification.selector,
					"message": data.notification.message
				});
				if (data.status == "success") {
					$timeout(function () {
						$(".modal-backdrop").css({display: 'none'});
						$rootScope.route = data.route;
						$rootScope.user = data.user;
						$rootScope.channels = data.channels;
						$rootScope.directMessages = data.directMessages;		
					}, 2500);
				}
			},
			function (failure) {
				console.log(failure.data);
			}
		);
	};

	$scope.validateUsername = function () {
		if ($scope.username != "" && $scope.username !== undefined) {
			$http({
				method: 'POST',
				url: 'validate',
				headers: {'Content-Type' : "application/json; charset=utf-8"},
				data: {"username": $scope.username}
			}).then(
				function (success) {
					$scope.validUsername = "glyphicon glyphicon-" + success.data.valid + "-circle";
					$scope.checkButton();
				},
				function (failure) {
					console.log(failure.data);
				}
			);
		} else {
			$scope.validUsername = "";
		}
	};

	$scope.validateNickname = function () {
		if ($scope.nickname != "" && $scope.nickname !== undefined) {
			$http({
				method: 'POST',
				url: 'validate',
				headers: {'Content-Type' : "application/json; charset=utf-8"},
				data: {"nickName": $scope.nickname}
			}).then(
				function (success) {
					$scope.validNickname = "glyphicon glyphicon-" + success.data.valid + "-circle";
					$scope.checkButton();
				},
				function (failure) {
					console.log(failure.data);
				}
			);
		} else {
			$scope.validNickname = "";
		}
	};
}])

.controller('messagesController', ['$document', '$scope', '$http', '$timeout', '$rootScope', '$location', '$filter', '$interval', 'messagingService', 'notifyService', function($document, $scope, $http, $timeout, $rootScope, $location, $filter, $interval, messagingService, notifyService) {
	
	$scope.mentions = 0;
	$scope.length = function (object) {
		return Object.keys(object).length;
	}
	
	// Scope variables
	$scope.user = $rootScope.user;
	$scope.channels = {};
	$scope.directMessages = {};
	$scope.threads = {};
	$scope.activeChat;
	$scope.activeThread;
	$scope.showDropdown = false;
	$scope.showSubscribersList = false;
	$scope.oppositeStatus;
	$scope.disableChannelCreation = true;
	$scope.found = {
		"status": false
	};
	
	var pack = function () {
		var to;
		if ($scope.isChannel) to = $scope.activeChat.name;
		if ($scope.isDirectMessage) to = $scope.activeChat.user.nickName;
		var message = {
			"parentId": $scope.parentId | 0,
			"from": {
				"nickName": $scope.user.nickName,
				"description": $scope.user.description,
				"status": $scope.user.status,
				"lastSeen": $scope.user.lastSeen,
				"photoUrl": $scope.user.photoUrl
			},
			"to": to,
			"text": $scope.inputMessage,
			"lastUpdate": $filter('date')(Date.now(), "MMM dd,yyyy HH:mm:ss"),
			"time": $filter('date')(Date.now(), "MMM dd,yyyy HH:mm:ss")
		};

		return JSON.stringify(message);
	};

	var unpack = function (json) {
		var message = JSON.parse(json);
		// Check for mention
		if (message.text.indexOf("@" + $scope.user.nickName) != -1) {
			$scope.mentions += 1;
			message.mention = true;
		} else {
			message.mention = false;
		}

		var scrollPos = $("#chat-console").prop("scrollHeight") - $("#chat-console").prop("scrollTop") - $("#chat-console").prop("clientHeight");
		
		if (message.parentId == 0) {
			if ($scope.channels[message.to] != undefined) {
				$scope.channels[message.to].messages[message.id] = message;
				$scope.channels[message.to].newMessages += 1;
				$scope.channels[message.to].mentions += message.mention ? 1 : 0;
			} else {
				if (message.to == $scope.user.nickName && $scope.directMessages[message.from.nickName] !== undefined) {
					$scope.directMessages[message.from.nickName].messages[message.id] = message;
					$scope.directMessages[message.from.nickName].newMessages += 1;
					$scope.directMessages[message.from.nickName].mentions += message.mention ? 1 : 0;
				} else if (message.to == $scope.user.nickName && $scope.directMessages[message.from.nickName] == undefined) {
					getDirectMessageData(message.from.nickName);
				} else {
					$scope.directMessages[message.to].messages[message.id] = message;
					$scope.directMessages[message.to].mentions += message.mention ? 1 : 0;
				}
			}

			if (scrollPos == 0) {
				$scope.activeChat.newMessages = 0;
				$scope.mentions -= $scope.activeChat.mentions;
				$scope.activeChat.mentions = 0;
				$timeout(function () {
					$("#chat-console").animate({scrollTop: $("#chat-console").prop("scrollHeight") - $("#chat-console").prop("clientHeight")}, 500);
				}, 1);
			}
		} else {
			threads[message.id] = message;
			updateThreadParent(message);
		}

		$scope.$apply();
	};

	var updateThreadParent = function (message) {

	};

	// Ifi functions
	(function () {
		$("#main-activity-window").height($(window).height() - $("#top-header").height());
		$("#activity-window").height(0.9 * $("#main-activity-window").height());
		$("#typing-area").height(0.1 * $("#main-activity-window").height());
		$("#active-thread").height($("#main-activity-window").height());
		$("#main-activity-window .sidebar").height($("#main-activity-window").height());
	})();
	
	$("#chat-console").on('scroll', function () {
		if (this.scrollTop <= 0) {
			if ($scope.isChannel) {
				getTenChannelMessages($scope.activeChat.name);
			} else {
				getTenDirectChatMessages($scope.activeChat.user.nickName);
			}
		}

		if (this.scrollTop == $("#chat-console").prop("scrollHeight") - $("#chat-console").prop("clientHeight")) {
			$scope.activeChat.newMessages = 0;
			$scope.activeChat.mentions = 0;
		}
	});

	var user = $scope.user;
	var sessionUri = "ws://" + $location.host() + ":" + $location.port() + "/gotcha/" + user.nickName;
	$scope.session = new WebSocket(sessionUri);
	// Define websocket methods
	// On connection open
	$scope.session.onopen = function (event) {
		console.log("Connected to server...");
	};
	// On received message
	$scope.session.onmessage = function (event) {
		unpack(event.data);
	};
	// On error
	$scope.session.onerror = function (event) {
		notify("Error: " + event.data);
	};
	// On connection close
	$scope.session.onclose = function (event) {
		$rootScope.session = null;
		console.log("disconnected from server...");
	};

	// Send message
	$scope.send = function () {
		var message = pack();
		$scope.session.send(message);
		$timeout(function () {
			$("#chat-console").animate({scrollTop: $("#chat-console").prop("scrollHeight") - $("#chat-console").prop("clientHeight")}, 500);
			$scope.activeChat.newMessages = 0;
		}, 2);
		$scope.inputMessage = undefined;
	};

	$scope.close = function () {
		$scope.session.close();
	};

	// Scope watchers
	$scope.$watch(function () {
		return $scope.user.status;
	}, function (newValue, oldValue) {
		$scope.oppositeStatus = newValue == "active" ? "away" : "active";
	});

	$scope.$watch(function () {
		return $scope.inputMessage;
	}, function (newValue, oldValue) {
		if (newValue === undefined || newValue == "") {
			$(".glyphicon-send").css("color", "lightgrey");
		} else {
			$(".glyphicon-send").css("color", "#007AB8");
		}
	});
	
	$scope.$watch(function () {
		if ($scope.channelName !== undefined && $scope.channelName !== "" && /^[a-zA-Z\d\-_.,]+$/.test($scope.channelName) && $scope.valid == "glyphicon glyphicon-ok-circle") {
			$scope.disableChannelCreation = false;
		} else {
			$scope.disableChannelCreation = true;
		}
	});
	
	// Scope event binding	
	$("#profile-dropdown-menu-toggle").bind('click', function(event) {
		event.stopPropagation();
	});

	$document.bind('click', function () {
		$scope.showDropdown = false;
		$scope.showSubscribersList = false;
		$scope.$apply();
	});

	// Toggle dropdown menu
	$scope.toggleShow = function () {
		$scope.showDropdown = !$scope.showDropdown;
	};

	$scope.showSubscribers = function () {
		$scope.showSubscribersList = !$scope.showSubscribersList;
	}

	// Logout from the system
	$scope.logout = function () {
		$http({
			method: 'POST',
			url: 'logout',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: {}
		}).then(
			function (success) {
				var data = success.data;
				$rootScope.route = data.route;
				$scope.close();
			},
			function (failure) {
				console.log(failure.data);
			}
		);
	};

	// Update typing area send button
	$scope.checkButton = function () {
		if ($scope.chatInput !== undefined || $scope.chatInput != "") {
			$scope.disabled = false;
		} else {
			$scope.disabled = true;
		}
	};

	// User status update
	$scope.changeStatus = function () {
		var user = {
			"status": $scope.oppositeStatus
		};

		$http({
			method: 'POST',
			url: 'setStatus',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: user
		}).then(
			function (success) {
				$scope.user.status = $scope.oppositeStatus;
			},
			function (failure) {
				console.log("cannot change status!");
			}
		);
	};
	
	// Channel name validation
	$scope.validate = function () {
		if ($scope.channelName !== undefined && $scope.channelName != "") {
			$http({
				method: 'POST',
				url: 'validate',
				headers: {'Content-Type' : "application/json; charset=utf-8"},
				data: {"name": $scope.channelName}
			}).then(
				function (success) {
					if (/^[a-zA-Z\d\-_,]+$/.test($scope.channelName)) {
						$scope.valid = "glyphicon glyphicon-" + success.data.valid + "-circle";
					} else {
						$scope.valid = "glyphicon glyphicon-ban-circle";
					}
				},
				function (failure) {
					console.log(failure.data);
				}
			);
		} else {
			$scope.valid = "";
		}
	}

	// Channel creation method
	$scope.createChannel = function () {
		var channel = {
			"name": $scope.channelName,
			"description": $scope.channelDescription,
			"createdBy": $scope.user.username,
			"createdTime": $filter('date')(Date.now(), "MMM dd,yyyy HH:mm:ss")
		};

		$http({
			method: 'POST',
			url: 'createChannel',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: channel
		}).then(
			function (success) {
				var data = success.data;
				notifyService.alert({
					"status": data.status,
					"selector": data.notification.selector,
					"message": data.notification.message
				});
				if (data.status == "success") {
					$scope.subscribe(data.channel.name);
					$timeout(function () {
						$("#create-channel-form").css({display: 'none'});
						$(".modal-backdrop").css({display: 'none'});
						$rootScope.route = data.route;
						$scope.channelName = "";
						$scope.channelDescription = "";
						$scope.valid = "";
					}, 1500);
				}
			},
			function (failure) {
				console.log("Cannot create channel!");
			}
		);
	};

	// Subscribe to the given channel
	$scope.subscribe = function (channel) {
		
		if ($scope.channels[channel] !== undefined) return;
		
		var subscription = {
			"nickname": $scope.user.nickName,
			"channel": channel
		};

		$http({
			method: 'POST',
			url: 'subscribe',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: subscription
		}).then(
			function (success) {
				var data = success.data;
				notifyService.alert({
					"status": data.status,
					"selector": data.notification.selector,
					"message": data.notification.message
				});
				if (data.status == "success") {
					$rootScope.route = data.route;
					getChannelData(data.subscription.channel);
					$timeout(function () {
						$scope.openChannel(data.subscription.channel);
					}, 1000);
				}
			},
			function (failure) {
				console.log("Cannot subscribe to channel!");
			}
		);
	};
	
	// Ubsubscribe from the given channel
	$scope.unsubscribe = function (channel) {
		var subscription = {
				"nickname": $scope.user.nickName,
				"channel": channel
		};
		
		$http({
			method: 'POST',
			url: 'unsubscribe',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: subscription
		}).then(
			function (success) {
				var data = success.data;
				notifyService.alert({
					"status": data.status,
					"selector": data.notification.selector,
					"message": data.notification.message
				});
				if (data.status == "success") {
					delete $scope.channels[channel];
					$timeout(function () {
						$rootScope.route = data.route;					
					}, 1000);
				}
			},
			function (failure) {
				console.log("Cannot unsubscribe from the channel!");
			}
		);
	};
	
	// Open channel chat method
	$scope.openChannel = function (channel) {
		$scope.closeThread();
		$("#channels-list li").removeClass("active-chat");
		$("#direct-messages-list li").removeClass("active-chat");
		$("#channel-" + channel).addClass("active-chat");
		$scope.isChannel = true;
		$scope.isDirectMessage = false;
		$scope.activeChat = $scope.channels[channel];
		$scope.channels[channel].newMessages = 0;
		$scope.mentions -= $scope.channels[channel].mentions;
		$scope.channels[channel].mentions = 0;
		$scope.channels[channel].lastRead = Date.now();
		$scope.query = undefined;
		$timeout(function () {
			$("#chat-console").animate({scrollTop: $("#chat-console").prop("scrollHeight") - $("#chat-console").prop("clientHeight")}, 100);
		}, 1);
	};
	
	// Open direct chat method
	$scope.openDirectMessage = function (nickname) {
		$scope.closeThread();
		if ($scope.directMessages[nickname] == undefined) {
			getDirectMessageData(nickname);
			$timeout(function () {
				$("#channels-list li").removeClass("active-chat");
				$("#direct-messages-list li").removeClass("active-chat");
				$("#message-" + nickname).addClass("active-chat");
				$scope.isChannel = false;
				$scope.isDirectMessage = true;
				$scope.activeChat = $scope.directMessages[nickname];
				$scope.directMessages[nickname].newMessages = 0;
				$scope.mentions -= $scope.directMessages[nickname].mentions;
				$scope.directMessages[nickname].mentions = 0;
				$scope.directMessages[nickname].lastRead = Date.now();
				$timeout(function () {
					$("#chat-console").animate({scrollTop: $("#chat-console").prop("scrollHeight") - $("#chat-console").prop("clientHeight")}, 100);
				}, 1);
			}, 1000);
		} else {
			$("#channels-list li").removeClass("active-chat");
			$("#direct-messages-list li").removeClass("active-chat");
			$("#message-" + nickname).addClass("active-chat");
			$scope.isChannel = false;
			$scope.isDirectMessage = true;
			$scope.activeChat = $scope.directMessages[nickname];
			$scope.directMessages[nickname].newMessages = 0;
			$scope.mentions -= $scope.directMessages[nickname].mentions;
			$scope.directMessages[nickname].mentions = 0;
			$scope.directMessages[nickname].lastRead = Date.now();
			$timeout(function () {
				$("#chat-console").animate({scrollTop: $("#chat-console").prop("scrollHeight") - $("#chat-console").prop("clientHeight")}, 100);
			}, 1);
		}
		
		$scope.query = undefined;
	};
	
	// Retrieve given channel data
	var getChannelData = function (name) {
		var channel = {
				"name": name
		};
		
		$http({
			method: 'POST',
			url: 'channelData',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: channel
		}).then(
			function (success) {
				$scope.channels[name] = success.data;
				$scope.channels[name].messages = {};
				$scope.channels[name].newMessages = 0;
				$scope.channels[name].mentions = 0;
				$scope.channels[name].lastRead = $scope.user.lastSeen;
				getTenChannelMessages(name);
			},
			function (failure) {
				console.log("Error while trying to retrive channel data.");
			}
		);
	};
	
	// Retrieve given channel messages
	var getTenChannelMessages = function (channel) {
		var message = {
			"id": $scope.length($scope.channels[channel].messages),
			"to": channel,
			"time": $scope.user.signedUp
		};

		$http({
			method: 'POST',
			url: 'getTenChannelMessages',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: message
		}).then(
			function (success) {
				var scrollPos = $("#chat-console").prop("scrollHeight") - $("#chat-console").prop("scrollTop") - $("#chat-console").prop("clientHeight");
				success.data.forEach(function (message) {
					message.from = JSON.parse(message.from);
					message.repliable = $scope.channels[channel].subscribers[message.from.nickName] !== undefined ? true : false;
					$scope.channels[channel].messages[message.id] = message;
					var messageTime = Date.parse(message.lastUpdate);
					var lastRead = Date.parse($scope.channels[channel].lastRead);
					if (messageTime >= lastRead && message.from != $scope.user.nickName) {
						$scope.channels[channel].newMessages += 1;
						if (message.text.indexOf("@" + $scope.user.nickName) != -1) {
							$scope.mentions += 1;
							$scope.channels[channel].mentions += 1;
						}
					}
					if (message.text.indexOf("@" + $scope.user.nickName) != -1) {
						message.mention = true;
					}
				});

				if ($scope.activeChat == $scope.channels[channel] && success.data.length > 0) {
					$timeout(function () {
						$("#chat-console").scrollTop($("#chat-console").prop("scrollHeight") - $("#chat-console").prop("clientHeight") - scrollPos);
					}, 1);
				}
			},
			function (failure) {
				console.log("Error while retrieving channel messages.");
			}
		);
	};
	
	// Retrieve user data
	var getDirectMessageData = function (nickname) {
		var user = {
				"nickName": nickname
		};
		
		$http({
			method: 'POST',
			url: 'getDirectMessageData',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: user
		}).then(
			function (success) {
				$scope.directMessages[nickname] = success.data;
				$scope.directMessages[nickname].messages = {};
				$scope.directMessages[nickname].newMessages = 0;
				$scope.directMessages[nickname].mentions = 0;
				$scope.directMessages[nickname].lastRead = $scope.user.lastSeen;
				getTenDirectChatMessages(nickname);
			},
			function (failure) {
				console.log("Error while trying to retrive channel data.");
			}
		);
	};
	
	// Retrieve given channel messages
	var getTenDirectChatMessages = function (nickname) {
		var message = {
			"id": $scope.length($scope.directMessages[nickname].messages),
			"from": nickname,
			"to": $scope.user.nickName
		};

		$http({
			method: 'POST',
			url: 'getTenDirectChatMessages',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: message
		}).then(
			function (success) {
				var scrollPos = $("#chat-console").prop("scrollHeight") - $("#chat-console").prop("scrollTop") - $("#chat-console").prop("clientHeight");
				success.data.forEach(function (message) {
					message.from = JSON.parse(message.from);
					message.repliable = true;
					$scope.directMessages[nickname].messages[message.id] = message;
					var messageTime = Date.parse(message.lastUpdate);
					var lastRead = Date.parse($scope.directMessages[nickname].lastRead);
					if (messageTime >= lastRead && message.from != $scope.user.nickName) {
						$scope.directMessages[nickname].newMessages += 1;
						if (message.text.indexOf("@" + $scope.user.nickName) != -1) {
							$scope.mentions += 1;
							$scope.directMessages[nickname].mentions += 1;
						}
					}
					if (message.text.indexOf("@" + $scope.user.nickName) != -1) {
						message.mention = true;
					}
				});

				if ($scope.activeChat == $scope.directMessages[nickname] && success.data.length > 0) {
					$timeout(function () {
						$("#chat-console").scrollTop($("#chat-console").prop("scrollHeight") - $("#chat-console").prop("clientHeight") - scrollPos);
					}, 1);
				}
			},
			function (failure) {
				console.log("Error while retrieving channel messages.");
			}
		);
	};

	$scope.openThread = function (message) {
		$scope.activeThread = message;
		$("#activity-window").fadeIn('slow', function() {
			$("#activity-window").removeClass("col-md-10 col-sm-10");
			$("#activity-window").addClass("col-md-6 col-sm-6");
			$("#active-thread").addClass("col-md-4 col-sm-4");
		});
	};

	$scope.closeThread = function () {
		$scope.activeThread = undefined;
		$("#activity-window").fadeIn('slow', function() {
			$("#activity-window").removeClass("col-md-6 col-sm-6");
			$("#activity-window").addClass("col-md-10 col-sm-10");
			$("#active-thread").removeClass("col-md-4 col-sm-4");
		});
	};

	$scope.getTenThreadMessages = function (thread) {

	};

	$scope.showMentions = function () {
		$scope.mentions = 0;
		// TODO
	};

	$rootScope.channels.forEach(function (channel) {
		getChannelData(channel);
		$timeout(function () {
			if ($scope.length($scope.channels) > 0) {
				$scope.openChannel(Object.keys($scope.channels)[0]);
			} else if ($scope.length($scope.directMessages > 0)) {
				$scope.openDirectMessage(Object.keys($scope.directMessages)[0]);
			}
		}, 100);
	});
	
	$rootScope.directMessages.forEach(function (directMessage) {
		getDirectMessageData(directMessage);
	});

	$interval(function () {
		$("#direct-messages-list ul li .other-user-nickName").each(function () {
			var user = {
				"nickName": this.innerText
			};

			$http({
				method: 'POST',
				url: 'getStatus',
				headers: {'Content-Type' : "application/json; charset=utf-8"},
				data: user
			}).then(
				function (success) {
					var nickname = success.data.user.nickName;
					var status = success.data.user.status;
					var lastSeen = success.data.user.lastSeen;

					$scope.directMessages[nickname].user.status = status;
					$scope.directMessages[nickname].user.lastSeen = lastSeen;
				}
			);
		});

		if ($scope.activeChat !== undefined && $scope.isChannel) {

		}

	}, 3000);
	
	$scope.search = function () {
		var query = {
			"in": "Channel OR User",
			"what": $scope.query
		};

		$http({
			method: 'POST',
			url: 'search',
			headers: {'Content-Type' : "application/json; charset=utf-8"},
			data: query
		}).then(
			function (success) {
				$scope.found.status = true;
				$scope.found.channels = success.data.channels;
				$scope.found.channels.forEach(function (channel) {
					channel.subscribed = $scope.channels[channel.name] !== undefined ? true : false;
				});
				$scope.found.users = success.data.users;
			},
			function (failure) {
				$scope.found.status = false;
				$scope.found.message = "We did not find any matches for your search!"
			}
		);
	};
}])