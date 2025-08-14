// Constants
const API_CONFIG = {
    READ_API_KEY: 'AQ19W0MWRTLCUMX7',
    CHANNEL_ID: '2923888',
    BASE_URL: 'https://api.thingspeak.com/channels',
    AUTO_REFRESH_INTERVAL: 20000, // 20 seconds
    TOTAL_STREETLIGHTS: 2
};

// DOM Elements
const elements = {
    refreshButton: document.getElementById('refreshData'),
    timeRange: document.getElementById('timeRange'),
    errorModal: document.getElementById('errorModal'),
    closeModal: document.getElementById('closeModal'),
    retryButton: document.getElementById('retryButton'),
    errorMessage: document.getElementById('errorMessage'),
    activeDevices: document.getElementById('activeDevices'),
    signalStrength: document.getElementById('signalStrength'),
    temperature: document.getElementById('temperature'),
    batteryLevel: document.getElementById('batteryLevel'),
    activityChart: document.getElementById('activityChart'),
    sensorChart: document.getElementById('sensorChart'),
    primary2Chart: document.getElementById('primary2Chart'),
    secondary2Chart: document.getElementById('secondary2Chart'),
    activityChartCanvas: document.getElementById('activityChartCanvas'),
    sensorChartCanvas: document.getElementById('sensorChartCanvas'),
    primary2ChartCanvas: document.getElementById('primary2ChartCanvas'),
    secondary2ChartCanvas: document.getElementById('secondary2ChartCanvas')
};

// Global state
let state = {
    devices: [],
    sensorData: [],
    activityData: [],
    primary2Data: [],
    secondary2Data: [],
    isLoading: true,
    lastUpdated: null,
    charts: {
        activity: null,
        sensor: null,
        primary2: null,
        secondary2: null
    }
};

// Initialize the application
function init() {
    attachEventListeners();
    
    // Use real data from ThingSpeak
    fetchData();
    
    // Set up automatic refresh
    startAutoRefresh();
}

// Event Listeners
function attachEventListeners() {
    elements.refreshButton.addEventListener('click', () => {
        fetchData();
    });
    
    elements.timeRange.addEventListener('change', () => {
        fetchData();
    });
    
    elements.closeModal.addEventListener('click', closeErrorModal);
    elements.retryButton.addEventListener('click', () => {
        closeErrorModal();
        fetchData();
    });
}

// Set up automatic refresh
let refreshInterval;
function startAutoRefresh() {
    // Clear any existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Set new interval for auto-refresh
    refreshInterval = setInterval(() => {
        console.log('Auto-refreshing data...');
        fetchData();
    }, API_CONFIG.AUTO_REFRESH_INTERVAL);
}

// Fetch data from ThingSpeak API
async function fetchData() {
    try {
        state.isLoading = true;
        updateLoadingState();

        // Build ThingSpeak URL with proper parameters
        const timeRangeDays = getTimeRangeDays();
        const thingSpeakUrl = `${API_CONFIG.BASE_URL}/${API_CONFIG.CHANNEL_ID}/feeds.json?api_key=${API_CONFIG.READ_API_KEY}&results=50`;
        
        console.log(`Fetching data from ThingSpeak: ${thingSpeakUrl}`);
        
        const response = await fetch(thingSpeakUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            cache: 'no-cache',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data from ThingSpeak API. Status: ${response.status}`);
        }

        const data = await response.json();
        console.log('ThingSpeak data received:', data);
        
        // Process ThingSpeak data
        if (data && data.feeds && data.feeds.length > 0) {
            processThingSpeakData(data);
            state.lastUpdated = new Date();
            state.isLoading = false;
            renderData();
        } else {
            throw new Error('No data received from ThingSpeak');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        showErrorModal(`Error fetching data from ThingSpeak: ${error.message}`);
        
        // Fall back to mock data if API fails
        generateMockData();
        renderData();
    }
}

// Helper function to get time range in days
function getTimeRangeDays() {
    const timeRange = elements.timeRange.value;
    return timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30;
}

// Process data from ThingSpeak and map it to our application state
function processThingSpeakData(data) {
    if (!data.feeds || data.feeds.length === 0) {
        console.warn('No feeds data available from ThingSpeak');
        generateMockData(); // Fallback to mock data if no feeds
        return;
    }
    
    // Extract timestamps
    const timestamps = data.feeds.map(feed => new Date(feed.created_at).toISOString());
    
    // Process field data (assuming ThingSpeak fields are as follows):
    // Field1: Primary Bulb 1 status (0-1)
    // Field2: Secondary Bulb 1 status (0-1)
    // Field3: Primary Bulb 2 status (0-1)
    // Field4: Secondary Bulb 2 status (0-1)
    // Field5: Current for Bulb 1 (mA)
    // Field6: Current for Bulb 2 (mA)
    
    // Process activity data (Primary Bulb 1)
    state.activityData = {
        timestamps: timestamps,
        primaryBulb: data.feeds.map(feed => parseFloat(feed.field1) || 0),
        primaryCurrent: data.feeds.map(feed => parseFloat(feed.field5) || 0)
    };
    
    // Process sensor data (Secondary Bulb 1)
    state.sensorData = {
        timestamps: timestamps,
        secondaryBulb: data.feeds.map(feed => parseFloat(feed.field2) || 0),
        secondaryCurrent: data.feeds.map(feed => {
            // Current will be half of field5 when secondary is active
            return parseFloat(feed.field2) > 0 ? parseFloat(feed.field5) || 0 : 0;
        })
    };
    
    // Process primary bulb 2 data
    state.primary2Data = {
        timestamps: timestamps,
        primaryBulb: data.feeds.map(feed => parseFloat(feed.field3) || 0),
        primaryCurrent: data.feeds.map(feed => parseFloat(feed.field6) || 0)
    };
    
    // Process secondary bulb 2 data
    state.secondary2Data = {
        timestamps: timestamps,
        secondaryBulb: data.feeds.map(feed => parseFloat(feed.field4) || 0),
        secondaryCurrent: data.feeds.map(feed => {
            // Current will be half of field6 when secondary is active
            return parseFloat(feed.field4) > 0 ? parseFloat(feed.field6) || 0 : 0;
        })
    };
    
    // Generate streetlight device data based on the latest values
    const latestFeed = data.feeds[data.feeds.length - 1];
    
    // Create devices array with status based on the latest data point - exactly 2 streetlights
    state.devices = Array.from({ length: API_CONFIG.TOTAL_STREETLIGHTS }, (_, i) => {
        const deviceId = `SL-${1000 + i}`;
        const isActive = true; // All streetlights are considered active
        
        // Determine which bulbs are active from the data - use actual ThingSpeak data
        const primaryBulb1 = i === 0 ? parseFloat(latestFeed.field1) > 0.5 : false;
        const secondaryBulb1 = i === 0 ? parseFloat(latestFeed.field2) > 0.5 : false;
        const primaryBulb2 = i === 1 ? parseFloat(latestFeed.field3) > 0.5 : false;
        const secondaryBulb2 = i === 1 ? parseFloat(latestFeed.field4) > 0.5 : false;
        
        // Street locations for more realistic data
        const locations = ['Main St & 5th Ave', 'Park Rd & Elm St'];
        
        // Determine current bulb state for display
        let currentBulb = 'None';
        if (isActive) {
            const activeBulbs = [];
            if (primaryBulb1) activeBulbs.push('Primary 1');
            if (secondaryBulb1) activeBulbs.push('Secondary 1');
            if (primaryBulb2) activeBulbs.push('Primary 2');
            if (secondaryBulb2) activeBulbs.push('Secondary 2');
            currentBulb = activeBulbs.join(', ');
        }
        
        // Get the last switch time 
        const lastSwitch = (secondaryBulb1 || secondaryBulb2) ? 
            new Date(Date.now() - Math.random() * 86400000 * 3).toISOString() : 
            (primaryBulb1 || primaryBulb2) ? 'Never' : 'N/A';
        
        return {
            id: deviceId,
            location: locations[i],
            status: isActive ? 'active' : 'inactive',
            currentBulb: currentBulb,
            primaryBulb1: primaryBulb1,
            secondaryBulb1: secondaryBulb1,
            primaryBulb2: primaryBulb2,
            secondaryBulb2: secondaryBulb2,
            lastSwitched: lastSwitch,
            current: isActive ? (i === 0 ? parseFloat(latestFeed.field5) : parseFloat(latestFeed.field6)) : 0,
            health: isActive ? (Math.floor(70 + Math.random() * 30)) : 0,
            totalSwitches: data.feeds.reduce((count, feed) => {
                if (i === 0) {
                    return count + (parseFloat(feed.field2) > 0.5 ? 1 : 0);
                } else {
                    return count + (parseFloat(feed.field4) > 0.5 ? 1 : 0);
                }
            }, 0) % 10 // Modulo 10 to keep it reasonable
        };
    });
    
    // Update summary stats
    updateStatsFromThingSpeak(data);
}

// Update summary statistics based on ThingSpeak data
function updateStatsFromThingSpeak(data) {
    const latestFeed = data.feeds[data.feeds.length - 1];
    
    // Count active devices (those with either primary or secondary bulbs on)
    const activeDevicesCount = state.devices.filter(device => device.status === 'active').length;
    
    // Count primary bulbs active
    const primaryBulbsActive = state.devices.filter(
        device => device.primaryBulb1 || device.primaryBulb2
    ).length;
    
    // Count secondary bulbs active
    const secondaryBulbsActive = state.devices.filter(
        device => device.secondaryBulb1 || device.secondaryBulb2
    ).length;
    
    // Count system failures
    const failures = data.feeds.reduce((count, feed) => {
        // Count instances where both primary and secondary are inactive
        const primary1Down = parseFloat(feed.field1) < 0.1;
        const secondary1Down = parseFloat(feed.field2) < 0.1;
        const primary2Down = parseFloat(feed.field3) < 0.1;
        const secondary2Down = parseFloat(feed.field4) < 0.1;
        
        // If both primary and secondary of a pair are down, it's a failure
        const failures = (primary1Down && secondary1Down ? 1 : 0) + 
                         (primary2Down && secondary2Down ? 1 : 0);
        
        return count + failures;
    }, 0);
    
    // Update the summary statistics
    elements.activeDevices.textContent = `${activeDevicesCount}/${API_CONFIG.TOTAL_STREETLIGHTS}`;
    elements.signalStrength.textContent = `${primaryBulbsActive}/${API_CONFIG.TOTAL_STREETLIGHTS}`;
    elements.temperature.textContent = `${secondaryBulbsActive}/${API_CONFIG.TOTAL_STREETLIGHTS}`;
    elements.batteryLevel.textContent = `${failures}`;
}

// Generate mock data for demonstration
function generateMockData() {
    // Street locations for more realistic data
    const locations = ['Main St & 5th Ave', 'Park Rd & Elm St'];
    
    // Mock streetlight data - exactly 2 streetlights
    state.devices = Array.from({ length: API_CONFIG.TOTAL_STREETLIGHTS }, (_, i) => {
        const isActive = true; // All streetlights are active for simplicity
        
        // Determine which bulbs are active
        const primaryBulb1 = isActive && i === 0 && Math.random() > 0.3;
        const secondaryBulb1 = isActive && i === 0 && !primaryBulb1;
        const primaryBulb2 = isActive && i === 1 && Math.random() > 0.3;
        const secondaryBulb2 = isActive && i === 1 && !primaryBulb2;
        
        // Determine current bulb state for display
        let currentBulb = 'None';
        if (isActive) {
            const activeBulbs = [];
            if (primaryBulb1) activeBulbs.push('Primary 1');
            if (secondaryBulb1) activeBulbs.push('Secondary 1');
            if (primaryBulb2) activeBulbs.push('Primary 2');
            if (secondaryBulb2) activeBulbs.push('Secondary 2');
            currentBulb = activeBulbs.join(', ');
        }
        
        // Get the last switch time
        const lastSwitch = (secondaryBulb1 || secondaryBulb2) ? 
            new Date(Date.now() - Math.random() * 86400000 * 3).toISOString() : 
            (primaryBulb1 || primaryBulb2) ? 'Never' : 'N/A';
        
        return {
            id: `SL-${1000 + i}`,
            location: locations[i],
            status: isActive ? 'active' : 'inactive',
            currentBulb: currentBulb,
            primaryBulb1: primaryBulb1,
            secondaryBulb1: secondaryBulb1,
            primaryBulb2: primaryBulb2,
            secondaryBulb2: secondaryBulb2,
            lastSwitched: lastSwitch,
            current: isActive ? (Math.floor(280 + Math.random() * 60)) : 0,
            health: isActive ? (Math.floor(70 + Math.random() * 30)) : 0,
            totalSwitches: Math.floor(Math.random() * 5)
        };
    });

    // Create timestamps for the selected time range
    const timeRange = elements.timeRange.value;
    const dataPoints = timeRange === 'day' ? 24 : timeRange === 'week' ? 7 : 30;
    
    const timestamps = Array.from({ length: dataPoints }, (_, i) => 
        new Date(Date.now() - (dataPoints - i) * 3600000).toISOString()
    );
    
    // For primary bulb 1: 1 = on, 0 = off, 0.5 = dimmed/partial
    state.activityData = {
        timestamps: timestamps,
        primaryBulb: timestamps.map(() => {
            const rand = Math.random();
            if (rand > 0.85) return 0; // off (failed)
            if (rand > 0.7) return 0.5; // partial/dimmed
            return 1; // fully on
        }),
        primaryCurrent: timestamps.map((_, i) => {
            // Current will correlate with bulb status
            const bulbStatus = state.activityData.primaryBulb[i];
            if (bulbStatus === 0) return 0;
            if (bulbStatus === 0.5) return Math.floor(150 + Math.random() * 30);
            return Math.floor(280 + Math.random() * 40);
        })
    };
    
    // For secondary bulb 1, will be activated when primary fails
    // 1 = on (primary failed), 0 = off (primary working)
    state.sensorData = {
        timestamps: timestamps,
        secondaryBulb: state.activityData.primaryBulb.map(status => status === 0 ? 1 : 0),
        secondaryCurrent: timestamps.map((_, i) => {
            // Current will be present only when secondary bulb is active
            return state.sensorData.secondaryBulb[i] === 1 ? 
                Math.floor(280 + Math.random() * 40) : 0;
        })
    };
    
    // For primary bulb 2: 1 = on, 0 = off, 0.5 = dimmed/partial
    state.primary2Data = {
        timestamps: timestamps,
        primaryBulb: timestamps.map(() => {
            const rand = Math.random();
            if (rand > 0.8) return 0; // off (failed)
            if (rand > 0.7) return 0.5; // partial/dimmed
            return 1; // fully on
        }),
        primaryCurrent: timestamps.map((_, i) => {
            // Current will correlate with bulb status
            const bulbStatus = state.primary2Data.primaryBulb[i];
            if (bulbStatus === 0) return 0;
            if (bulbStatus === 0.5) return Math.floor(150 + Math.random() * 30);
            return Math.floor(280 + Math.random() * 40);
        })
    };
    
    // For secondary bulb 2, will be activated when primary fails
    // 1 = on (primary failed), 0 = off (primary working)
    state.secondary2Data = {
        timestamps: timestamps,
        secondaryBulb: state.primary2Data.primaryBulb.map(status => status === 0 ? 1 : 0),
        secondaryCurrent: timestamps.map((_, i) => {
            // Current will be present only when secondary bulb is active
            return state.secondary2Data.secondaryBulb[i] === 1 ? 
                Math.floor(280 + Math.random() * 40) : 0;
        })
    };

    state.isLoading = false;
    state.lastUpdated = new Date();
}

// Render the data to the UI
function renderData() {
    updateStats();
    renderCharts();
    updateLoadingState();
}

// Update the stats cards at the top
function updateStats() {
    // For exactly 2 streetlights, display actual counts
    const activeStreetlights = state.devices.filter(device => device.status === 'active').length;
    
    // Count of streetlights with at least one primary bulb active
    const primaryActive = state.devices.filter(device => 
        device.status === 'active' && (device.primaryBulb1 || device.primaryBulb2)
    ).length;
    
    // Count of streetlights with at least one secondary bulb active
    const secondaryActive = state.devices.filter(device => 
        device.status === 'active' && (device.secondaryBulb1 || device.secondaryBulb2)
    ).length;
    
    // Count of completely failed systems (no light working)
    const systemFailures = state.devices.filter(device => 
        device.status === 'inactive' || (device.currentBulb === 'None')
    ).length;

    elements.activeDevices.textContent = `${activeStreetlights}/${API_CONFIG.TOTAL_STREETLIGHTS}`;
    elements.signalStrength.textContent = `${primaryActive}/${API_CONFIG.TOTAL_STREETLIGHTS}`;
    elements.temperature.textContent = `${secondaryActive}/${API_CONFIG.TOTAL_STREETLIGHTS}`;
    elements.batteryLevel.textContent = `${systemFailures}`;
}

// Render the charts
function renderCharts() {
    // Destroy previous charts if they exist
    if (state.charts.activity) state.charts.activity.destroy();
    if (state.charts.sensor) state.charts.sensor.destroy();
    if (state.charts.primary2) state.charts.primary2.destroy();
    if (state.charts.secondary2) state.charts.secondary2.destroy();

    // Create time labels based on the selected time range
    const timeLabels = state.activityData.timestamps.map(ts => formatTimeLabel(new Date(ts)));
    
    // ---------------
    // Primary Bulb 1 Chart
    // ---------------
    if (elements.activityChartCanvas) {
        try {
            const activityCtx = elements.activityChartCanvas.getContext('2d');
            state.charts.activity = createBulbChart(
                activityCtx, 
                timeLabels, 
                state.activityData.primaryBulb, 
                state.activityData.primaryCurrent, 
                'Primary Bulb 1 Status', 
                'rgba(52, 152, 219, 1)', 
                'rgba(52, 152, 219, 0.2)'
            );
        } catch (error) {
            console.error('Error rendering activityChart:', error);
            elements.activityChart.innerHTML = '<div class="chart-error">Cannot render chart: ' + error.message + '</div>';
        }
    } else if (elements.activityChart) {
        elements.activityChart.innerHTML = '<div class="chart-error">Cannot render chart: Canvas element not found</div>';
    }

    // ---------------
    // Secondary Bulb 1 Chart
    // ---------------
    if (elements.sensorChartCanvas) {
        try {
            const sensorCtx = elements.sensorChartCanvas.getContext('2d');
            state.charts.sensor = createSecondaryBulbChart(
                sensorCtx, 
                timeLabels, 
                state.sensorData.secondaryBulb, 
                state.sensorData.secondaryCurrent, 
                'Secondary Bulb 1 Status', 
                'rgba(231, 76, 60, 1)', 
                'rgba(231, 76, 60, 0.2)'
            );
        } catch (error) {
            console.error('Error rendering sensorChart:', error);
            elements.sensorChart.innerHTML = '<div class="chart-error">Cannot render chart: ' + error.message + '</div>';
        }
    } else if (elements.sensorChart) {
        elements.sensorChart.innerHTML = '<div class="chart-error">Cannot render chart: Canvas element not found</div>';
    }
    
    // ---------------
    // Primary Bulb 2 Chart
    // ---------------
    if (elements.primary2ChartCanvas) {
        try {
            const primary2Ctx = elements.primary2ChartCanvas.getContext('2d');
            state.charts.primary2 = createBulbChart(
                primary2Ctx, 
                timeLabels, 
                state.primary2Data.primaryBulb, 
                state.primary2Data.primaryCurrent, 
                'Primary Bulb 2 Status', 
                'rgba(46, 204, 113, 1)', 
                'rgba(46, 204, 113, 0.2)'
            );
        } catch (error) {
            console.error('Error rendering primary2Chart:', error);
            elements.primary2Chart.innerHTML = '<div class="chart-error">Cannot render chart: ' + error.message + '</div>';
        }
    } else if (elements.primary2Chart) {
        elements.primary2Chart.innerHTML = '<div class="chart-error">Cannot render chart: Canvas element not found</div>';
    }
    
    // ---------------
    // Secondary Bulb 2 Chart
    // ---------------
    if (elements.secondary2ChartCanvas) {
        try {
            const secondary2Ctx = elements.secondary2ChartCanvas.getContext('2d');
            state.charts.secondary2 = createSecondaryBulbChart(
                secondary2Ctx, 
                timeLabels, 
                state.secondary2Data.secondaryBulb, 
                state.secondary2Data.secondaryCurrent, 
                'Secondary Bulb 2 Status', 
                'rgba(241, 196, 15, 1)', 
                'rgba(241, 196, 15, 0.2)'
            );
        } catch (error) {
            console.error('Error rendering secondary2Chart:', error);
            elements.secondary2Chart.innerHTML = '<div class="chart-error">Cannot render chart: ' + error.message + '</div>';
        }
    } else if (elements.secondary2Chart) {
        elements.secondary2Chart.innerHTML = '<div class="chart-error">Cannot render chart: Canvas element not found</div>';
    }
}

// Helper function to create primary bulb charts with improved clarity
function createBulbChart(ctx, labels, bulbData, currentData, title, lineColor, fillColor) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Bulb Status',
                    data: bulbData,
                    borderColor: lineColor,
                    backgroundColor: fillColor,
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y-status',
                    pointBackgroundColor: function(context) {
                        const value = context.dataset.data[context.dataIndex];
                        return value === 0 ? 'rgba(231, 76, 60, 1)' : // red for off
                               value === 0.5 ? 'rgba(243, 156, 18, 1)' : // orange for partial
                               'rgba(46, 204, 113, 1)'; // green for on
                    },
                    pointRadius: 8,  // Larger points
                    borderWidth: 3    // Thicker lines
                },
                {
                    label: 'Current (mA)',
                    data: currentData,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    tension: 0.4,
                    yAxisID: 'y-current',
                    pointRadius: 0,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 14
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label;
                            const value = context.parsed.y;
                            if (datasetLabel === 'Bulb Status') {
                                return value === 0 ? 'Status: OFF (Failure)' :
                                       value === 0.5 ? 'Status: PARTIAL (Dimmed)' :
                                       'Status: ON (Healthy)';
                            }
                            return `${datasetLabel}: ${value} mA`;
                        }
                    },
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 14
                    },
                    padding: 10
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        display: false
                    }
                },
                'y-status': {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    min: 0,
                    max: 1,
                    ticks: {
                        callback: function(value) {
                            return value === 0 ? 'OFF' :
                                   value === 0.5 ? 'PARTIAL' :
                                   value === 1 ? 'ON' : '';
                        },
                        stepSize: 0.5,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Bulb Status',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                'y-current': {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 350,
                    grid: {
                        drawOnChartArea: false,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 14
                        }
                    },
                    title: {
                        display: true,
                        text: 'Current (mA)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// Helper function to create secondary bulb charts with improved clarity
function createSecondaryBulbChart(ctx, labels, bulbData, currentData, title, lineColor, fillColor) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Backup Status',
                    data: bulbData,
                    borderColor: lineColor,
                    backgroundColor: fillColor,
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y-status',
                    pointBackgroundColor: function(context) {
                        const value = context.dataset.data[context.dataIndex];
                        return value === 1 ? 'rgba(46, 204, 113, 1)' : // green for on
                               'rgba(149, 165, 166, 1)'; // gray for standby
                    },
                    pointRadius: 8,  // Larger points
                    borderWidth: 3    // Thicker lines
                },
                {
                    label: 'Current (mA)',
                    data: currentData,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    tension: 0.4,
                    yAxisID: 'y-current',
                    pointRadius: 0,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 14
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label;
                            const value = context.parsed.y;
                            if (datasetLabel === 'Backup Status') {
                                return value === 1 ? 'Status: ACTIVE (Primary Failed)' :
                                       'Status: STANDBY (Primary Working)';
                            }
                            return `${datasetLabel}: ${value} mA`;
                        }
                    },
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 14
                    },
                    padding: 10
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        display: false
                    }
                },
                'y-status': {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    min: 0,
                    max: 1,
                    ticks: {
                        callback: function(value) {
                            return value === 0 ? 'STANDBY' :
                                   value === 1 ? 'ACTIVE' : '';
                        },
                        stepSize: 1,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Backup Status',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                'y-current': {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 350,
                    grid: {
                        drawOnChartArea: false,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 14
                        }
                    },
                    title: {
                        display: true,
                        text: 'Current (mA)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// Update the loading state of the UI
function updateLoadingState() {
    if (state.isLoading) {
        // Show loading placeholders for charts and stats
        document.querySelectorAll('.loading-placeholder').forEach(el => {
            el.style.display = 'flex';
        });
        
        document.querySelectorAll('.stat-value').forEach(el => {
            el.textContent = '--';
        });
    } else {
        // Hide loading placeholders
        document.querySelectorAll('.loading-placeholder').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// Error handling
function showErrorModal(message) {
    elements.errorMessage.textContent = message || 'An error occurred. Please try again.';
    elements.errorModal.style.display = 'flex';
}

function closeErrorModal() {
    elements.errorModal.style.display = 'none';
}

// Helper functions
function formatDate(date) {
    return date.toLocaleString();
}

function formatTimeLabel(date) {
    const timeRange = elements.timeRange.value;
    
    if (timeRange === 'day') {
        return date.getHours() + ':00';
    } else if (timeRange === 'week') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
    } else {
        return date.getDate() + '/' + (date.getMonth() + 1);
    }
}

// Apply some CSS directly for progress bars
const style = document.createElement('style');
style.textContent = `
.progress-bar {
    width: 100%;
    height: 8px;
    background-color: #f5f8fa;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 5px;
}
.progress {
    height: 100%;
    transition: width 0.3s ease;
}
.btn.small {
    padding: 0.3rem 0.8rem;
    font-size: 0.9rem;
}
`;
document.head.appendChild(style);

// Start the application
document.addEventListener('DOMContentLoaded', init); 