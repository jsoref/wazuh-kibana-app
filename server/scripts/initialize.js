module.exports = function (server, options) {

    const client = server.plugins.elasticsearch.client;

    const colors = require('ansicolors');
    const blueWazuh = colors.blue('wazuh');

    const fs = require('fs');
    const OBJECTS_FILE = 'integration_files/objects_file.json';
    const MAPPING_FILE = 'integration_files/template_file.json';

    var setTemplate = function () {
        client.indices.exists({ index: 'ossec-*' }).then(
            function (result) {
                if (result) {
                    server.log([blueWazuh, 'initialize', 'info'], 'Index pattern "ossec-*" exists.');
                    configureKibana();
                } else {
                    server.log([blueWazuh, 'initialize', 'info'], 'Index pattern "ossec-*" not exists. Creating...');
                    createAndPutTemplate();
                }
            }, function () {
                server.log([blueWazuh, 'initialize', 'error'], 'Could not check if index pattern "ossec-*" exists.');
            }
        );
    };

    var createAndPutTemplate = function () {
        var fDate = new Date().toISOString().replace(/T/, '-').replace(/\..+/, '').replace(/-/g, '.').replace(/:/g, '').slice(0, -7);
        var todayIndex = 'ossec-' + fDate;

        client.indices.create({ index: todayIndex }).then(
            function () {
                try {
                    var jsondata = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
                } catch (e) {
                    server.log([blueWazuh, 'initialize', 'error'], 'Could not read the mapping file.');
                    server.log([blueWazuh, 'initialize', 'error'], 'Path: ' + MAPPING_FILE);
                    server.log([blueWazuh, 'initialize', 'error'], 'Exception: ' + e);
                };
                client.indices.putMapping({ index: 'ossec-*', type: 'ossec', body: { properties: { jsondata }}}).then(
                    function () {
                        server.log([blueWazuh, 'initialize', 'info'], 'Index pattern "ossec-*" was initialized successfully.');
                        insertSampleData(todayIndex);
                    }, function () {
                        server.log([blueWazuh, 'initialize', 'error'], 'Could not put mapping for "ossec-*" on elasticsearch.');
                    });
            }, function () {
                server.log([blueWazuh, 'initialize', 'error'], 'Could not create ' + todayIndex + ' index on elasticsearch.');
            }
        );
    };

    var insertSampleData = function (todayIndex) {
        var SAMPLE_DATA = {"rule": { "group": "", "sidid": 0, "firedtimes": 1, "groups": [ ], "PCI_DSS": [ ], "description": "This is the first alert on your ELK Cluster, please start OSSEC Manager and Logstash sever to start ship alerts.", "AlertLevel": 0 }, "full_log": "This is the first alert on your ELK Cluster, please start OSSEC Manager and Logstash sever to start ship alerts.", "decoder": { }, "location": "", "@version": "1", "@timestamp": new Date().toISOString(), "path": "", "host": "", "type": "ossec-alerts", "AgentName": "" };

        client.create({ index: todayIndex, type: 'ossec', id: 'sample', body: { SAMPLE_DATA } }).then(
            function () {
                server.log([blueWazuh, 'initialize', 'info'], 'Sample data was inserted successfully.');
                configureKibana();
            }, function () {
                server.log([blueWazuh, 'initialize', 'error'], 'Could not insert sample data.');
            });
    };

    var configureKibana = function () {
        server.log([blueWazuh, 'initialize', 'info'], 'Configuring Kibana for working with "ossec-*" index pattern...');
        client.create({ index: '.kibana', type: 'index-pattern', id: 'ossec-*', body: { title: 'ossec-*', timeFieldName: '@timestamp' } })
            .then(function () {
                server.log([blueWazuh, 'initialize', 'info'], 'Successfully configured!');
                setDefaultTime();
            }, function (response) {
                if (response.statusCode != '409') {
                    server.log([blueWazuh, 'initialize', 'error'], 'Could not configure "ossec-*" index pattern. Please, configure it manually on Kibana.');
                } else {
                    server.log([blueWazuh, 'initialize', 'info'], 'Skipping "ossec-*" index pattern configuration: Already configured.');
                }
            });
    };

    var setDefaultTime = function () {
        var needle = require('needle');
        server.log([blueWazuh, 'initialize', 'info'], 'Setting Kibana default time to last 24h...');

        var options = {
            rejectUnauthorized: false
        };

        var payload = {"value":"{  \"from\": \"now-24h\",  \"to\": \"now\",  \"mode\": \"quick\"}"};
        //NEEDS TO FIX THE ADDRESS USED
        needle.request('post', ADD+':'+PORT+'/api/kibana/settings/timepicker:timeDefaults', payload, options, function (error, response) {
            if (!error) {
                importObjects();
            } else {
                server.log([blueWazuh, 'initialize', 'error'], 'Could not set default time. Please, configure it manually on Kibana.');
            }
        });

    };

    var importObjects = function () {
        //ToDo
        server.log([blueWazuh, 'initialize', 'info'], 'Your ELK deployment was successfully configured, and is ready to be used!');
    };

    setTemplate();

};