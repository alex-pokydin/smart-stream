var onvif = require('onvif');
onvif.Discovery.on('device', function(cam){
	cam.username = 'admin';
	cam.password = '';
	console.log(cam);
	cam.connect(function(){
		//console.log(this)
		
		
		
		console.log('connected');
		  var cam = this;
		  this.getVideoEncoderConfigurations(function(err, confs, xml){
			confs.forEach(function(conf){
		        if(conf.name == 'VideoE_000'){
		            conf.rateControl = { frameRateLimit: 30, encodingInterval: 1, bitrateLimit: 6000 };
				}
				cam.setVideoEncoderConfiguration(conf, function(err, conf, xml){
			        console.log('changedConf',conf);
		        });
		        
			});
		  });
	  
	    var date = new Date().getTime();
		date += (3 * 60 * 60 * 1000);
		
	  	this.setSystemDateAndTime({dateTime: new Date(date), dateTimeType: 'NTP', daylightSavings: true},function(err, stream, xml) {
	    	console.log('setSystemDateAndTime',stream);
	  	});
		
		
		
	});
})
onvif.Discovery.probe({device: 'eth0'});
