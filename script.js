const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// MongoDB Connection
mongoose.connect('mongodb+srv://shamishchandra:wc5M3b3kFg8hctFo@cluster0.gc1d65f.mongodb.net/qr_scanner_db_nss', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected')).catch(err => console.log(err));

// Define Schemas
const eventSchema = new mongoose.Schema({
    name: { type: String, required: true },
    date: { type: Date, default: Date.now },
    scans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Scan' }]
});


const scanSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    entryTime: { type: Date, required: true },
    exitTime: { type: Date },
    isPresent: { type: Boolean },
    duration: { type: Number }
});
const activitySchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    entryTime: { type: Date, required: true },
    exitTime: { type: Date },
    duration: { type: Number }
});

const Event = mongoose.model('Event', eventSchema);
const Scan = mongoose.model('Scan', scanSchema);
const Activity = mongoose.model('Activity', activitySchema);


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// HTML content
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>COGAAN Scanner Pro</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { background-color: #f8f9fa; }
        .container { max-width: 800px; }
        .card {
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            border: none;
            border-radius: 15px;
        }
        .card-header {
            background-color: #007bff;
            color: white;
            border-top-left-radius: 15px !important;
            border-top-right-radius: 15px !important;
        }
        #video {
            width: 100%;
            max-width: 400px;
            border-radius: 10px;
        }
        canvas { display: none; }
        .warning {
            color: #dc3545;
            font-size: 0.875rem;
        }
        #qrResult {
            max-height: 300px;
            overflow-y: auto;
        }
        .scanned-item {
            background-color: #e9ecef;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 10px;
        }
        .nav-pills .nav-link.active {
            background-color: #007bff;
        }
    </style>
</head>
<body>
    <div class="container mt-5">
        <h1 class="text-center mt-2 mb-4"><i class="fas fa-qrcode"></i> <b>NSS Scanner</b></h1>
        <div class="card mb-4">
            <h2 class="card-header">QR Scanner</h2>
            <div class="card-body">
                <ul class="nav nav-pills mb-3" id="pills-tab" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="pills-scan-tab" data-bs-toggle="pill" data-bs-target="#pills-scan" type="button" role="tab">Scan</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="pills-upload-tab" data-bs-toggle="pill" data-bs-target="#pills-upload" type="button" role="tab">Upload</button>
                    </li>
                </ul>
                <div class="tab-content" id="pills-tabContent">
                    <div class="tab-pane fade show active" id="pills-scan" role="tabpanel">
                        <div class="mb-3">
                            <label for="name" class="form-label">Event Name</label>
                            <input type="text" id="name" placeholder="Enter Event Name" class="form-control" />
                            <p id="required" class="warning mt-1"></p>
                        </div>
                        <button class="btn btn-primary mb-3" onclick="checkOpen()"><i class="fas fa-camera"></i> Scan QR Code</button>
                        <div class="text-center">
                            <video id="video" playsinline class="mb-3"></video>
                        </div>
                    </div>
                    <div class="tab-pane fade" id="pills-upload" role="tabpanel">
                        <div class="mb-3">
                            <label for="qrUpload" class="form-label">Upload QR Code Image</label>
                            <input type="file" class="form-control" id="qrUpload" accept="image/*" onchange="uploadQR(event)">
                        </div>
                    </div>
                </div>
                <canvas id="canvas"></canvas>
                <div id="qrResult"></div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://rawgit.com/schmich/instascan-builds/master/instascan.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script>
        let currentEventId = null;
        let scanner;
        const title = document.getElementById("name");
        const required = document.getElementById("required");

        async function checkOpen() {
            if (title.value === "") {
                required.textContent = "Event name is required*";
                required.classList.add("warning");
                return;
            }
            
            try {
                const response = await fetch('/api/events', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: title.value })
                });
                
                const data = await response.json();
                currentEventId = data._id;
                required.textContent = "";
                required.classList.remove("warning");
                openCamera();
            } catch (error) {
                showError('Error creating event: ' + error.message);
            }
        }

        function openCamera() {
            const video = document.getElementById('video');
            
            scanner = new Instascan.Scanner({
                video: video
            });

            Instascan.Camera.getCameras().then(function(cameras) {
                if (cameras.length > 0) {
                    let selectedCamera = cameras[cameras.length - 1];
                    scanner.start(selectedCamera);
                } else {
                    showError('No cameras found.');
                }
            }).catch(function(error) {
                showError('Error accessing camera: ' + error);
            });

            scanner.addListener('scan', function(content) {
                handleQRData(content);
            });
        }

        function uploadQR(event) {
            const file = event.target.files[0];
            if (file) {
                const html5QrCode = new Html5Qrcode("qrResult");
                html5QrCode.scanFile(file, true)
                    .then(decodedText => {
                        handleQRData(decodedText);
                    })
                    .catch(err => {
                        showError('Error scanning uploaded file: ' + err);
                    });
            }
        }

        async function handleQRData(qrData) {
            try {
                const response = await fetch('/api/scans', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        studentId: qrData,
                        eventId: currentEventId
                    })
                });

                const data = await response.json();
                
                if (data.isExit) {
                    Swal.fire({
                        title: 'Student Exit',
                        text: 'Duration of presence: ' + formatDuration(data.duration),
                        icon: 'info',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    removeItemFromDisplay(qrData);
                } else {
                    displayQRData(qrData, data._id);
                    Swal.fire({
                        title: 'Success!',
                        text: 'Student entry recorded',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
            } catch (error) {
                showError('Error processing scan: ' + error.message);
            }
        }

        function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return hours + 'h ' + minutes + 'm ' + remainingSeconds + 's';
}


        function showError(message) {
            Swal.fire({
                title: 'Error!',
                text: message,
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }

        function displayQRData(qrData, scanId) {
            const resultDiv = document.getElementById('qrResult');
            const newItem = document.createElement('div');
            newItem.classList.add('scanned-item');
            newItem.setAttribute('id', scanId);
            newItem.textContent = qrData;
        }

        function removeItemFromDisplay(scanId) {
            const item = document.getElementById(scanId);
            if (item) {
                item.remove();
            }
        }
    </script>
</body>
</html>`;

// Routes
app.get('/', (req, res) => {
    res.send(htmlContent);
});

app.post('/api/events', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Event name is required' });
    }
    let event = await Event.findOne({ name });
    if (!event) {
        event = new Event({ name });
        await event.save();
    }
    res.json(event);
});

app.post('/api/scans', async (req, res) => {
    const { studentId, eventId } = req.body;
    const event = await Event.findById(eventId).populate('scans');

    let scan = await Scan.findOne({ studentId, eventId });

    if (!scan) {
        scan = new Scan({ studentId, eventId, entryTime: new Date(), isPresent: true, duration: null, exitTime: null });
        await scan.save();
        event.scans.push(scan);
        await event.save();
        return res.json(scan);
    }
    if (!scan.isPresent) {
        scan.isPresent = true;
        scan.exitTime = null;
        scan.duration = null;
        scan.entryTime = new Date();
        scan.eventId = eventId;
        await scan.save();
        event.scans.push(scan);
        await event.save();

        return res.json(scan);
    }
    let activity;
    if (scan.isPresent) {
        scan.exitTime = new Date();
        scan.duration = (scan.exitTime - scan.entryTime) / 1000;
        scan.isPresent = false;
        activity = new Activity({ studentId: scan.studentId, eventId: scan.eventId, entryTime: scan.entryTime, duration: scan.duration, exitTime: scan.exitTime });
        await activity.save();
        await scan.save();
        return res.json({ isExit: true, duration: scan.duration });
    }

});

app.get('/api/events/:eventId/export', async (req, res) => {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).populate('scans');

    if (!event) {
        return res.status(404).json({ error: 'Event not found' });
    }

    const rows = event.scans.map(scan => {
        return `${scan.studentId},${scan.entryTime},${scan.exitTime},${scan.duration}`;
    }).join('\n');

    const csvData = `Student ID,Entry Time,Exit Time,Duration\n${rows}`;
    res.header('Content-Type', 'text/csv');
    res.attachment(`${event.name}_data.csv`);
    res.send(csvData);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
