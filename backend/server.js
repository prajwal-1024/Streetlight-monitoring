const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Create Express application
const app = express();
const PORT = process.env.PORT || 3000;

// API Keys for ThingSpace API
const READ_API_KEY = process.env.READ_API_KEY || 'AQ19W0MWRTLCUMX7';
const WRITE_API_KEY = process.env.WRITE_API_KEY || 'G8CTBDQ23S12WWS4';
const THINGSPACE_BASE_URL = process.env.THINGSPACE_BASE_URL || 'https://thingspace-api.verizon.com';

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
const apiRouter = express.Router();

// Validate API Key middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || (apiKey !== READ_API_KEY && apiKey !== WRITE_API_KEY)) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
};

// Mock devices data (for demo purposes)
const mockDevices = [
    {
        id: 'device-1',
        status: 'active',
        type: 'sensor',
        lastUpdated: new Date().toISOString(),
        battery: 85,
        signal: 92,
    },
    {
        id: 'device-2',
        status: 'active',
        type: 'gateway',
        lastUpdated: new Date().toISOString(),
        battery: 65,
        signal: 78,
    },
    {
        id: 'device-3',
        status: 'inactive',
        type: 'tracker',
        lastUpdated: new Date(Date.now() - 86400000).toISOString(),
        battery: 12,
        signal: 25,
    },
    {
        id: 'device-4',
        status: 'active',
        type: 'monitor',
        lastUpdated: new Date().toISOString(),
        battery: 92,
        signal: 88,
    },
    {
        id: 'device-5',
        status: 'active',
        type: 'sensor',
        lastUpdated: new Date().toISOString(),
        battery: 45,
        signal: 67,
    }
];

// Generate mock sensor data based on time range
const generateMockSensorData = (timeRange) => {
    const dataPoints = timeRange === 'day' ? 24 : timeRange === 'week' ? 7 : 30;
    
    return {
        temperature: Array.from({ length: dataPoints }, (_, i) => ({
            timestamp: new Date(Date.now() - (dataPoints - i) * 3600000).toISOString(),
            value: 20 + Math.random() * 10
        })),
        humidity: Array.from({ length: dataPoints }, (_, i) => ({
            timestamp: new Date(Date.now() - (dataPoints - i) * 3600000).toISOString(),
            value: 40 + Math.random() * 20
        })),
        pressure: Array.from({ length: dataPoints }, (_, i) => ({
            timestamp: new Date(Date.now() - (dataPoints - i) * 3600000).toISOString(),
            value: 990 + Math.random() * 30
        }))
    };
};

// Generate mock activity data based on time range
const generateMockActivityData = (timeRange) => {
    const dataPoints = timeRange === 'day' ? 24 : timeRange === 'week' ? 7 : 30;
    
    return {
        transmissions: Array.from({ length: dataPoints }, (_, i) => ({
            timestamp: new Date(Date.now() - (dataPoints - i) * 3600000).toISOString(),
            value: Math.floor(Math.random() * 100)
        })),
        errors: Array.from({ length: dataPoints }, (_, i) => ({
            timestamp: new Date(Date.now() - (dataPoints - i) * 3600000).toISOString(),
            value: Math.floor(Math.random() * 10)
        }))
    };
};

// Endpoint to get devices
apiRouter.get('/devices', validateApiKey, async (req, res) => {
    try {
        // In a real app, this would call the ThingSpace API
        // const response = await axios.get(`${THINGSPACE_BASE_URL}/devices`, {
        //     headers: {
        //         'Authorization': `Bearer ${READ_API_KEY}`
        //     }
        // });
        // return res.json(response.data);
        
        // For demo, return mock data with a slight delay to simulate API call
        setTimeout(() => {
            res.json(mockDevices);
        }, 500);
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

// Endpoint to get sensor data
apiRouter.get('/sensorData', validateApiKey, async (req, res) => {
    try {
        const { timeRange = 'day' } = req.query;
        
        // In a real app, this would call the ThingSpace API
        // const response = await axios.get(`${THINGSPACE_BASE_URL}/sensor-data?timeRange=${timeRange}`, {
        //     headers: {
        //         'Authorization': `Bearer ${READ_API_KEY}`
        //     }
        // });
        // return res.json(response.data);
        
        // For demo, return mock data
        setTimeout(() => {
            res.json(generateMockSensorData(timeRange));
        }, 700);
    } catch (error) {
        console.error('Error fetching sensor data:', error);
        res.status(500).json({ error: 'Failed to fetch sensor data' });
    }
});

// Endpoint to get activity data
apiRouter.get('/activity', validateApiKey, async (req, res) => {
    try {
        const { timeRange = 'day' } = req.query;
        
        // In a real app, this would call the ThingSpace API
        // const response = await axios.get(`${THINGSPACE_BASE_URL}/activity?timeRange=${timeRange}`, {
        //     headers: {
        //         'Authorization': `Bearer ${READ_API_KEY}`
        //     }
        // });
        // return res.json(response.data);
        
        // For demo, return mock data
        setTimeout(() => {
            res.json(generateMockActivityData(timeRange));
        }, 600);
    } catch (error) {
        console.error('Error fetching activity data:', error);
        res.status(500).json({ error: 'Failed to fetch activity data' });
    }
});

// Mount API router
app.use('/api/thingspace', apiRouter);

// Catch-all route to serve the frontend for any other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 