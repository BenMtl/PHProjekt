/**
 * This software is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License version 3 as published by the Free Software Foundation
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * @category   PHProjekt
 * @package    Application
 * @subpackage Calendar2
 * @copyright  Copyright (c) 2010 Mayflower GmbH (http://www.mayflower.de)
 * @license    LGPL v3 (See LICENSE file)
 * @link       http://www.phprojekt.com
 * @since      File available since Release 6.1
 * @version    Release: @package_version@
 * @author     Gustavo Solt <solt@mayflower.de>
 */

dojo.provide("phpr.Calendar2.Form");

dojo.declare("phpr.Calendar2.Form", phpr.Default.Form, {
    _multipleEvents:       null,
    _multipleParticipants: null,
    _owner:                null,
    _currentDate:          null,
    _currentTime:          null,
    _updateCacheIds:       null,
    _participantsInDb:     null,
    _participantsInTab:    null,

    _FRMWIDG_BASICDATA:  0,
    _FRMWIDG_PARTICIP:   1,
    _FRMWIDG_RECURRENCE: 2,

    initData:function() {
        // Get all the active users
        this.userStore = new phpr.Store.User();
        this._initData.push({'store': this.userStore});

        // Get the tags
        this._tagUrl = phpr.webpath + 'index.php/Default/Tag/jsonGetTagsByModule/moduleName/' + phpr.module
            + '/id/' + this.id;
        this._initData.push({'url': this._tagUrl});
    },

    setPermissions:function(data) {
        if (this.id > 0) {
            this._accessPermissions = true;
            this._writePermissions  = true;
            this._deletePermissions = true;
        }
    },

    prepareSubmission:function() {
        if (!this.inherited(arguments)) {
            return false;
        }

        if (this.id > 0) {
            if (this.sendData['rruleFreq'] && null === this._multipleEvents) {
                // If the event has recurrence ask what to modify
                this.showEventSelector('Edit', "submitForm");
                return false;
            }
        }

        // Check if rule for recurrence is set
        if (this.id > 0 && false === this._multipleEvents) {
            this.sendData['rrule'] = null;
        } else if (this.sendData['rruleFreq']) {
            // Set frequence
            var rrule = 'FREQ=' + this.sendData['rruleFreq'];

            // Set until value if available
            if (this.sendData['rruleUntil']) {
                until = this.sendData['rruleUntil'];
                if (!until.setHours) {
                    until = phpr.Date.isoDateTojsDate(until);
                }
                var startDatetime = phpr.Date.isoDatetimeTojsDate(this.sendData['start']);
                until.setHours(startDatetime.getHours());
                until.setMinutes(startDatetime.getMinutes());
                until.setSeconds(startDatetime.getSeconds());
                until = dojo.date.add(until, 'minute', until.getTimezoneOffset());
                rrule += ';UNTIL=' + dojo.date.locale.format(until, {datePattern: 'yyyyMMdd\'T\'HHmmss\'Z\'',
                    selector: 'date'});
                this.sendData['rruleUntil'] = null;
            }

            // Set interval if available
            if (this.sendData['rruleInterval']) {
                rrule += ';INTERVAL=' + this.sendData['rruleInterval'];
                this.sendData['rruleInterval'] = null;
            }

            // Set weekdays if available
            if (this.sendData['rruleByDay[]']) {
                rrule += ';BYDAY=' + this.sendData['rruleByDay[]'];
                this.sendData['rruleByDay[]'] = null;
            } else if (this.sendData['rruleByDay']) {
                rrule += ';BYDAY=' + this.sendData['rruleByDay'];
                this.sendData['rruleByDay'] = null;
            }
            this.sendData['rruleFreq'] = null;

            this.sendData['rrule'] = rrule;
        } else {
            this.sendData['rrule'] = null;
        }

        this.sendData['multipleEvents']       = this._multipleEvents;
        this.sendData['multipleParticipants'] = this._multipleParticipants;

        return true;
    },

    addModuleTabs:function(data) {
        this._owner = true;
        if (this.id > 0) {
            this._owner = data[0]["rights"]["currentUser"]["admin"];
        }

        if (this._owner) {
            this.addParticipantsTab(data);
        }

        this.addRecurrenceTab(data);
        this.addNotificationTab(data);
        this.addHistoryTab();
    },

    postRenderForm:function() {
        // Summary:
        //    User functions after render the form
        // Description:
        //    Apply for special events on the fields
        if (dijit.byId('startDatetime_forDate')) {
            this._currentDate = dijit.byId('startDatetime_forDate').value;
            dojo.connect(dojo.byId('startDatetime_forDate'), "onblur", this, 'startDateBlur');
        } else {
            this._currentDate = null;
        }
        if (dijit.byId('startDatetime_forTime')) {
            this._currentTime = dijit.byId('startDatetime_forTime').value;
            dojo.connect(dojo.byId('startDatetime_forTime'), "onblur", this, 'startTimeBlur');
        } else {
            this._currentTime = null;
        }
    },

    startDateBlur:function() {
        // Summary:
        //    Checks whether to change the End date according to the modification of Start date
        // Description:
        //   If it has changed to a valid date, then add or substract the difference between previous and current value
        // to the End date
        if (this._currentDate != dijit.byId('startDatetime_forDate').value) {
            if (dijit.byId('startDatetime_forDate').isValid()) {
                diff = dojo.date.difference(this._currentDate, dijit.byId('startDatetime_forDate').value, 'day');
                dijit.byId('endDatetime_forDate').set('value', dojo.date.add(dijit.byId('endDatetime_forDate').value,
                    'day', diff));
                this._currentDate = dijit.byId('startDatetime_forDate').value;
            }
        }
    },

    startTimeBlur:function() {
        // Summary:
        //    Checks whether to change the End time according to the modification of Start time
        // Description:
        //    If it has changed to a valid time, then add or substract the difference between previous and current value
        // to the End time
        if (this._currentTime != dijit.byId('startDatetime_forTime').value) {
            if (dijit.byId('startDatetime_forTime').isValid()) {
                diff = dojo.date.difference(this._currentTime, dijit.byId('startDatetime_forTime').value, 'minute');
                dijit.byId('endDatetime_forTime').set('value', dojo.date.add(dijit.byId('endDatetime_forTime').value,
                    'minute', diff));
                this._currentTime = dijit.byId('startDatetime_forTime').value;
            }
        }
    },

    addParticipantsTab:function(data) {
        // Summary:
        //    Participants tab
        // Description:
        //    Display all the users for add into the event
        var userList       = this.userStore.getList();
        var currentUser    = data[0]["rights"]["currentUser"]["userId"] || 0;
        var participantIds = data[0]["participants"];
        var participants   = new Array();
        var users          = new Array();
        var statuses       = data[0]["confirmationStatuses"];

        if (userList) {
            for (var i in userList) {
                // Make an array with the users except the current one
                if (userList[i].id != currentUser) {
                    users.push({'id': userList[i].id, 'name': userList[i].display});
                }
            }
        }

        // Make an array with the current participants
        for (var i in participantIds) {
            if (participantIds[i] != currentUser) {
                for (var j in userList) {
                    if (userList[j].id == participantIds[i]) {
                        var userName = userList[j].display;
                        break;
                    }
                }
                var status;
                switch (statuses[participantIds[i]]) {
                    case "1": status="?"; break;
                    case "2": status="A"; break;
                    case "3": status="R"; break;
                }

                participants.push({
                    'userId':   participantIds[i],
                    'userName': userName,
                    'status':   status
                });
            }
        }
        this._participantsInDb  = participants.length;
        this._participantsInTab = participants.length;

        // Template for the participants tab
        var participantData = this.render(["phpr.Calendar2.template", "participanttab.html"], null, {
            participantUserText:    phpr.nls.get('User'),
            participantActionText:  phpr.nls.get('Action'),
            users:                  users,
            currentUser:            currentUser,
            participants:           participants
        });

        this.addTab(participantData, 'tabParticipant', 'Participants', 'participantFormTab');

        // Add button for participant
        var params = {
            label:     '',
            iconClass: 'add',
            alt:       'Add',
            baseClass: 'smallIcon'
        };
        newParticipant = new dijit.form.Button(params);
        dojo.byId("participantAddButton").appendChild(newParticipant.domNode);
        dojo.connect(newParticipant, "onClick", dojo.hitch(this, "newParticipant"));

        // Delete buttons for participant
        for (i in participants) {
            var userId     = participants[i]["userId"];
            var buttonName = "participantDeleteButton" + userId;
            var params = {
                label:     '',
                iconClass: 'cross',
                alt:       'Delete',
                baseClass: 'smallIcon'
            };

            var tmp = new dijit.form.Button(params);
            dojo.byId(buttonName).appendChild(tmp.domNode);
            dojo.connect(tmp, "onClick", dojo.hitch(this, "deleteParticipant", userId));
        }
    },

    newParticipant:function() {
        // Summary:
        //    Add a new row of one participant
        // Description:
        //    Add a the row of one participant
        var userId = dijit.byId("dataParticipantAdd").get('value');
        if (!dojo.byId("trParticipantFor" + userId) && userId > 0) {
            phpr.destroyWidget("dataParticipant[" + userId + "]");
            phpr.destroyWidget("ParticipantDeleteButton" + userId);

            var userName = dijit.byId("dataParticipantAdd").get('displayedValue');
            var table    = dojo.byId("participantTable");
            var row      = table.insertRow(table.rows.length);
            row.id       = "trParticipantFor" + userId;

            var cell = row.insertCell(0);
            cell.innerHTML = 'N';   // Status: new participant
            var cell = row.insertCell(1);
            cell.innerHTML = '<input id="dataParticipant[' + userId + ']" name="newParticipants[]" '
                + ' type="hidden" value="' + userId + '" dojoType="dijit.form.TextBox" />' + userName;
            var cell = row.insertCell(2);
            cell.innerHTML = '<div id="participantDeleteButton' + userId + '"></div>';

            dojo.parser.parse(row);

            var buttonName = "participantDeleteButton" + userId;
            var params = {
                label:     '',
                iconClass: 'cross',
                alt:       'Delete',
                baseClass: 'smallIcon'
            };
            var tmp = new dijit.form.Button(params);
            dojo.byId(buttonName).appendChild(tmp.domNode);
            dojo.connect(dijit.byId(tmp.id), "onClick", dojo.hitch(this, "deleteParticipant", userId));

            this._participantsInTab += 1;
        }
    },

    deleteParticipant:function(userId) {
        // Summary:
        //    Remove the row of one participant
        // Description:
        //    Remove the row of one participant
        //    and destroy all the used widgets
        phpr.destroyWidget("dataParticipant[" + userId + "]");
        phpr.destroyWidget("participantDeleteButton" + userId);

        var e      = dojo.byId("trParticipantFor" + userId);
        var parent = e.parentNode;
        parent.removeChild(e);
        this._participantsInTab -= 1;
    },

    addRecurrenceTab:function(data) {
        // Summary:
        //    Adds a tab for recurrence
        // Description:
        //    Adds a tab to configure the rules if/when the event will reoccure
        var recurrenceTab = '';

        // Preset values
        var values = {
            FREQ: '',
            INTERVAL: 1,
            UNTIL: '',
            BYDAY: ''
        };

        // Parse data to fill the form
        if (data[0].rrule && data[0].rrule.length > 0) {
            var rrule = data[0].rrule.split(';');
            for (var i = 0; i < rrule.length; i++) {
                rule  = rrule[i].split('=');
                name  = rule[0];
                value = rule[1];
                switch (name) {
                    case 'UNTIL':
                        value = dojo.date.locale.parse(value, {datePattern: "yyyyMMdd'T'HHmmss'Z'", selector: 'date'});
                        value = dojo.date.add(value, 'minute', -value.getTimezoneOffset());
                        value = dojo.date.locale.format(value, {datePattern: 'yyyy-MM-dd', selector: 'date'});
                        break;
                }
                values[name] = value;
            }
        }

        // Create ranges
        var rangeFreq = new Array(
            {'id': '', 'name': phpr.nls.get('None')},
            {'id': 'DAILY', 'name': phpr.nls.get('Daily')},
            {'id': 'WEEKLY', 'name': phpr.nls.get('Weekly')},
            {'id': 'MONTHLY', 'name': phpr.nls.get('Monthly')},
            {'id': 'YEARLY', 'name': phpr.nls.get('Yearly')}
        );

        var rangeByday = new Array(
            {'id': 'MO', 'name': phpr.nls.get('Monday')},
            {'id': 'TU', 'name': phpr.nls.get('Tuesday')},
            {'id': 'WE', 'name': phpr.nls.get('Wednesday')},
            {'id': 'TH', 'name': phpr.nls.get('Thursday')},
            {'id': 'FR', 'name': phpr.nls.get('Friday')},
            {'id': 'SA', 'name': phpr.nls.get('Saturday')},
            {'id': 'SU', 'name': phpr.nls.get('Sunday')}
        );

        // Add fields
        // If the user is not the owner, can see the recurrence but disabled (add hidden fields for keep the value)
        if (this.id > 0) {
            var disabled = !this._owner;
        } else {
            var disabled = false;
        }
        var intervalHelp = phpr.nls.get('The interval for the option selected in Repeats.')
            + '<br />' + phpr.nls.get('E.g.: Repeats Weekly - Interval 2, that will create one event every 2 weeks.');
        var untilHelp = phpr.nls.get('The day the recurrence will stop happening.')
            + '<br />' + phpr.nls.get('The last event\'s day could not match this day.');
        recurrenceTab += this.fieldTemplate.selectRender(rangeFreq, phpr.nls.get('Repeats'), 'rruleFreq', values.FREQ,
            false, disabled);
        recurrenceTab += this.fieldTemplate.textFieldRender(phpr.nls.get('Interval'), 'rruleInterval',
            values.INTERVAL, 10, false, disabled, intervalHelp);
        recurrenceTab += this.fieldTemplate.dateRender(phpr.nls.get('Until'), 'rruleUntil', values.UNTIL, false,
            disabled, untilHelp);
        recurrenceTab += this.fieldTemplate.multipleSelectRender(rangeByday, phpr.nls.get('Weekdays'), 'rruleByDay',
            values.BYDAY, false, disabled);

        // Add the tab to the form
        this.addTab(recurrenceTab, 'tabRecurrence', 'Recurrence', 'recurrenceTab');
    },

    deleteForm:function() {
        // Summary:
        //    This function is responsible for deleting a dojo element
        // Description:
        //    This function calls jsonDeleteAction

        var rruleFreq = this.formsWidget[this._FRMWIDG_RECURRENCE].get('value')['rruleFreq'];
        if (this.id > 0) {
            // If the event has recurrence or is at least one participant added in participants tab, ask what to modify
            if (rruleFreq && null === this._multipleEvents) {
                this.showEventSelector('Delete', "deleteForm");
                return false;
            }
        }

        this.sendData.multipleEvents       = this._multipleEvents;
        this.sendData.multipleParticipants = this._multipleParticipants;

        phpr.send({
            url:       phpr.webpath + 'index.php/' + phpr.module + '/index/jsonDelete/id/' + this.id
                                                                 + '/start/' + this._presetValues['start'],
            content:   this.sendData,
            onSuccess: dojo.hitch(this, function(data) {
               new phpr.handleResponse('serverFeedback', data);
               if (data.type == 'success') {
                   phpr.send({
                        url: phpr.webpath + 'index.php/Default/Tag/jsonDeleteTags/moduleName/' + phpr.module
                            + '/id/' + this.id,
                        onSuccess: dojo.hitch(this, function(data) {
                            new phpr.handleResponse('serverFeedback', data);
                            if (data.type == 'success') {
                                this.publish("updateCacheData");
                                this.publish("setUrlHash", [phpr.module]);
                            }
                        })
                    });
               }
            })
        });
    },

    showEventSelector:function(action, nextFunction) {
        dojo.byId("eventSelectorContainer").innerHTML = '';

        dojo.byId('eventSelectorTitle').innerHTML = phpr.nls.get(action + ' repeating events');
        dijit.byId('eventSelectorDialog').set('title', phpr.nls.get('Calendar2'));

        // Add button for one event
        var params = {
            label: phpr.nls.get(action + ' just this occurrence'),
            alt:   phpr.nls.get(action + ' just this occurrence')
        };
        var singleEvent = new dijit.form.Button(params);
        dojo.byId("eventSelectorContainer").appendChild(singleEvent.domNode);
        dojo.connect(singleEvent, "onClick", dojo.hitch(this, function() {
            this._multipleEvents = false;
            dijit.byId('eventSelectorDialog').hide();
            eval('this.' + nextFunction + '()');
        }));

        // Add button for multiple event
        var params = {
            label: phpr.nls.get(action + ' all occurrences after this one'),
            alt:   phpr.nls.get(action + ' all occurrences after this one')
        };
        var multipleEvent = new dijit.form.Button(params);
        dojo.byId("eventSelectorContainer").appendChild(multipleEvent.domNode);
        dojo.connect(multipleEvent, "onClick", dojo.hitch(this, function() {
            this._multipleEvents = true;
            dijit.byId('eventSelectorDialog').hide();
            eval('this.' + nextFunction + '()');
        }));

        dijit.byId('eventSelectorDialog').show();
    },

    updateData:function() {
        this.inherited(arguments);

        // Delete the cache of the 3 urls for every related event?
        if (this._relatedData && this._relatedData.relatedEvents) {
            // Make an array with the related events
            this._updateCacheIds = this._relatedData.relatedEvents.split(',');
            if (this._updateCacheIds.length > 0 && this.useCache) {
                this.updateCacheIds();
            }
        }
        phpr.DataStore.deleteData({url: this._relatedDataUrl});
    },

    updateCacheIds:function() {
        // Summary:
        //    This function deletes the cache of the 3 urls for the ids stored in _updateCacheIds
        for (idPos in this._updateCacheIds) {
            var id         = this._updateCacheIds[idPos];
            var url        = phpr.webpath + 'index.php/' + phpr.module + '/index/jsonDetail/nodeId/1/id/' + id;
            var relatedUrl = phpr.webpath + 'index.php/' + phpr.module + '/index/jsonGetRelatedData/id/' + id;
            var tagUrl     = phpr.webpath + 'index.php/Default/Tag/jsonGetTagsByModule/moduleName/' + phpr.module
                + '/id/' + id;
            phpr.DataStore.deleteData({url: url});
            phpr.DataStore.deleteData({url: relatedUrl});
            phpr.DataStore.deleteData({url: tagUrl});
        }
    },

    setUrl:function() {
        this._url = phpr.webpath + 'index.php/' + phpr.module + '/index/jsonDetail/nodeId/'
                  + phpr.currentProjectId + '/id/' + this.id + '/start/' + this._presetValues['start'];
    }
});
