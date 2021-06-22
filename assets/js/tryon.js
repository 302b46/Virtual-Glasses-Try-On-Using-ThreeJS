
var TryOn = function (params) {
    var ref = this;

    this.selector = 'tryon';
    //sizes
    this.object = params.object;
    this.width = params.width;
    this.height = params.height;

    if (params.statusHandler) {
        this.statusHandler = params.statusHandler;
    } else {
        this.statusHandler = function(){};
    }
    this.changeStatus = function(status) {
        this.status = status;
        this.statusHandler(this.status);
    };
    this.changeStatus('Begin Try-on');

    if (params.debug) {
        this.debug = true;
        this.debugMsg = this.status;
    } else {
        this.debug = false;
    }

    /* CAMERA */
    this.video = document.getElementById('camera');
    document.getElementById(this.selector).style.width = this.width + "px";
    this.video.setAttribute('width', this.width);
    this.video.setAttribute('height', this.height);

    /* face tracker */
    this.tracker = new clm.tracker({useWebGL: true});
    this.tracker.init();

    /**
     * Start try-on
     * @returns {undefined}
     */
    this.start = function() {
        var video = ref.video;

        navigator.getUserMedia = (
            navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia
        );

        if (navigator.getUserMedia) {
            navigator.getUserMedia(
                {
                    video: true
                },
                function (localMediaStream) {
                    video.srcObject = localMediaStream;
                    video.play();
                    ref.changeStatus('Could Not Make It Work');
                },
                function (err) {
                    ref.changeStatus('Could Not Make It Work');
                }
            );
        } else {
            ref.changeStatus('Could Not Make It Work');
        }

        //start tracking
        ref.tracker.start(video);
        //continue in loop
        ref.loop();
    };

    

    this.debug = function(msg) {
        if (this.debug) {
            this.debugMsg += msg + "<br>";
        }
    };

    this.printDebug = function() {
        if (this.debug) {
            document.getElementById('debug').innerHTML = this.debugMsg;
            this.debugMsg = '';
        }
    };

    this.loop = function() {
        requestAnimFrame(ref.loop);

        var positions = ref.tracker.getCurrentPosition();

        if (positions) {
            //current distance
            var distance = Math.abs(90 / ((positions[0][0].toFixed(0) - positions[14][0].toFixed(0)) / 2));
            //horizontal angle 
            var hAngle = 90 - (positions[14][0].toFixed(0) - positions[33][0].toFixed(0)) * distance;
            //center point
            var center = {
                x: positions[33][0],
                y: (positions[33][1] + positions[41][1]) / 2
            };
            center = ref.correct(center.x, center.y);

            var zAngle = (positions[33][0] - positions[7][0]) * -1;

            //allowed distance
            if (distance < 1.5 && distance > 0.5) {
                ref.changeStatus('Face Recognized');

                //set positions
                ref.position.x = center.x - (hAngle / 2);
                ref.position.y = center.y;
                ref.rotation.y = hAngle / 100 / 2;
                ref.rotation.z = zAngle / 100 / 1.5;
                //size
                ref.size.x = ((positions[14][0] - positions[0][0]) / 2) + 0.05 * (positions[14][0] - positions[0][0]);
                ref.size.y = (ref.size.x / ref.images['front'].width) * ref.images['front'].height;
                ref.size.z = ref.size.x * 3;
                ref.position.z = (ref.size.z / 2) * -1;
                //render
            } else {
                ref.changeStatus('Searching');
                ref.size.x = 0;
                ref.size.y = 0;
            }

            ref.render();
            ref.debug(ref.status);
                
        }

        //print debug
        // ref.printDebug();
    };

    /* 3D */
    var canvas = document.getElementById("overlay");
    var renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setClearColor(0xffffff, 0);
    renderer.setSize(this.width, this.height);

    //add scene
    var scene = new THREE.Scene;

    //define sides
    var outside = {
        0 : 'left',
        1 : 'right',
        4 : 'front'
    };

    this.images = [];
    var materials = [];
    for (i = 0; i < 6; i++) {
        if (this.object.outside[outside[i]] !== undefined) {
            var image = new Image();
            image.src = this.object.outside[outside[i]];
            this.images[outside[i]] = image;
            materials.push(new THREE.MeshLambertMaterial({
                map: THREE.ImageUtils.loadTexture(this.object.outside[outside[i]]), transparent: true
            }));
        } else {
            materials.push(new THREE.MeshLambertMaterial({
                color: 0xffffff, transparent: true, opacity: 0
            }));
        }
    }

    //init position and size
    this.position = {
        x: 0,
        y: 0,
        z: 0
    };
    this.rotation = {
        x: 0,
        y: 0
    };
    this.size = {
        x: 1,
        y: 1,
        z: 1
    };

    //Setting up object (face)
    var geometry = new THREE.CubeGeometry(1, 1, 1);
    var materials = new THREE.MeshFaceMaterial(materials);
    var face = new THREE.Mesh( geometry, materials );
    face.doubleSided = true;
    scene.add(face);

    //Setting up camera
    var camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 5000);
    camera.lookAt(face.position);
    camera.position.z = this.width / 2;
    scene.add(camera);

    //Setting up lights
    var lightFront = new THREE.PointLight(0xffffff);
    lightFront.position.set(0, 0, 1000);
    lightFront.intensity = 0.6;
    scene.add(lightFront);

    var lightLeft = new THREE.PointLight(0xffffff);
    lightLeft.position.set(1000, 0, 0);
    lightLeft.intensity = 0.7;
    scene.add(lightLeft);

    var lightRight = new THREE.PointLight(0xffffff);
    lightRight.position.set(-1000, 0, 0);
    lightRight.intensity = 0.7;
    scene.add(lightRight);

  
    
    this.render = function() {
        //update position
        face.position.x = this.position.x;
        face.position.y = this.position.y;
        face.position.z = this.position.z;

        face.rotation.y = this.rotation.y;
        face.rotation.z = this.rotation.z;

        //update size
        face.scale.x = this.size.x;
        face.scale.y = this.size.y;
        face.scale.z = this.size.z;

        renderer.render(scene, camera);
    };

    /**
     * Transform position for 3D scene
     */
    this.correct = function(x, y) {
        return {
            x: ((this.width / 2 - x) * -1) / 2,
            y: (this.height / 2 - y) / 2
        };
    }

    //print debug
    // this.printDebug();
};

var tryOn = null;
$(window).load(function () {
    $('#tryonBtn').hide();

    var object = {
        outside: {
            left: 'https://i.ibb.co/JKr5VzY/left.png',
            right: 'https://i.ibb.co/VCxYrCB/right.png',
            front: 'https://i.ibb.co/TkdhGqn/front.png'

            // front: 'https://i.ibb.co/kMn2mSx/front.png'
        }
    };

    tryOn = new TryOn({
        width: 640, //width of the box containing the video
        height: 480, //height of the box containing the video
        debug: true,
        object: object,
        statusHandler: function(status) {
            switch(status) {
                case "Begin Try-on": {
                    /* Ready! Show start button or something... */
                    $('#tryonBtn').show();
                }; break;
                case "Could Not Make It Work": {
                    /* Handle camera error */
                }; break;
                case "Searching": {
                    /* Show some message while searching a face */
                }; break;
                case "Face Recognized": {
                    /* OK! */
                }
            }
        }
    });

    $('#tryonBtn').click(function() {
        tryOn.start();
    });
    $('#end').click(function() {

    })
});