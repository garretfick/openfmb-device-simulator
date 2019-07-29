
/*
 * Copyright 2019 Smarter Grid Solutions
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 /* eslint-disable detect-object-injection */

/**
 * Add a new definition into the specified table.
 * @param {Element} parent The table to insert into.
 * @param {string} name The name of the value that is being added.
 * @param {any} value The value that is being added.
 */
const addDefinition = (parent, name, value) => {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = name;

    const tdValue = document.createElement("td");
    tdValue.textContent = value;

    tr.appendChild(tdName);
    tr.appendChild(tdValue);
    parent.appendChild(tr);
}

/**
 * Adds information about the conducting equipment associated with the message.
 * @param {Element} parent The parent node to add into.
 * @param {object} profile The parsed profile.
 * @param {array} keys The list of keys to look for conducting equipment.
 */
const addConductingEquipment = (parent, profile, keys) => {
    Object.keys(profile)
        .filter((key) => keys.includes(key))
        .forEach((key) => {
            addDefinition(parent, "Conducting Equipment Name",
                          profile[key].conductingEquipment.namedObject.name);
            addDefinition(parent, "Conducting Equipment MRID",
                          profile[key].conductingEquipment.mRID);
        })
}

/**
 * Add a list of simple values into the table.
 * @param {Element} parent The parent table to insert into.
 * @param {object} values Object of values to insert. These values are JSON
 *                        objects following the normal OpenFMB structure.
 */
const addValuesDefinition = (parent, values) => {
    Object.keys(values).forEach((key) => {
        let units = values[key].units.value;
        if (units && units.startsWith("UnitSymbolKind_")) {
            units = " " + units.substr(15);
        }
        // If the value is the default, then it is omitted
        const value = values[key].actVal || 0;
        addDefinition(parent, key, "" + value + units);
    })
}

/**
 * Add a list of values into the table where each value will have phase
 * measurements.
 * @param {Element} parent The parent table to insert into.
 * @param {object} values Object of phase values to insert.
 */
const addPhaseValuesDefinition = (parent, values) => {
    Object.keys(values).forEach(key => {
        const phaseValues = values[key];
        Object.keys(phaseValues).forEach((phase) => {
            let units = phaseValues[phase].units && phaseValues[phase].units.SIUnit || "";
            if (units && units.startsWith("UnitSymbolKind_")) {
                units = " " + units.substr(15);
            }
            if (phaseValues[phase].hasOwnProperty("cVal")) {
                const value = "" + phaseValues[phase].cVal.mag.f + "∠" + phaseValues[phase].cVal.ang.f + units;
                addDefinition(parent, key + " " + phase, value);
            }
        })
    })
}

/**
 * Creates the entire definition for an object. This is a table element that
 * can be hosted in something else. In this way, we just replace the entire
 * table when we have new data for an object.
 * @param {object} evtData The message data that was received.
 */
const createDeviceDefinition = (evtData) => {
    const itemDefs = document.createElement("table");
    const iedMrid = evtData.ied.identifiedObject.mRID;
    itemDefs.id = iedMrid + "-defs";

    addDefinition(itemDefs, "IED MRID", iedMrid);

    const msgDate = new Date(0);
    msgDate.setUTCSeconds(parseInt(evtData.readingMessageInfo.messageInfo.messageTimeStamp.seconds, 10));
    addDefinition(itemDefs, "Message date", msgDate);
    addConductingEquipment(itemDefs, evtData, ["generatingUnit"]);
    addValuesDefinition(itemDefs, evtData.generationReading.readingMMTR);
    addPhaseValuesDefinition(itemDefs, evtData.generationReading.readingMMXU);

    return itemDefs;
}

/**
 * Callback to request a new device created.
 */
const createNewDevice = () => {
    fetch("/devices", { method: "POST" })
        .then(() => {
            console.log("Created device");
        })
        .catch(error => {
            console.log(error)
        })
}

/**
 * Callback to delete an existing device.
 */
const deleteDevice = event => {
    const iedMrid = event.target.getAttribute("data-mrid");

    fetch("/devices/" + iedMrid, { method: "DELETE" })
        .then(() => {
            console.log("Deleted device");
            // If we are successful, then remove the node.
            const devices = document.getElementById("devices");
            const iedElem = document.getElementById(iedMrid);
            if (iedElem) {
                devices.removeChild(iedElem);
            }
        })
        .catch(error => {
            console.log(error);
        });
}

/**
 * Handle new data for a device. This can either add the device to the list
 * or update an existing device.
 * @param {object} evtData The OpenFMB data that was received.
 */
const addOrUpdate = (evtData) => {
    const devices = document.getElementById("devices");

    // Which node with the devices table do we want to add this to?
    // Get the ID of the associated IED
    const iedMrid = evtData.ied.identifiedObject.mRID;

    // Do we have a node for this already? If not, we create it and add it now
    let iedElem = document.getElementById(iedMrid);
    let oldDlElem = document.getElementById(iedMrid + "-defs");
    if (!iedElem) {
        // Create the data element for this item
        iedElem = document.createElement("h5");
        iedElem.id = iedMrid;
        const iedHeading = document.createElement("div");
        iedHeading.className = "row";
        const nameElem = document.createElement("div");
        nameElem.textContent = iedMrid;
        nameElem.className = "seven columns";
        iedHeading.appendChild(nameElem);

        const deleteElem = document.createElement("button");
        deleteElem.textContent = "Delete";
        deleteElem.className = "two columns";
        deleteElem.addEventListener("click", deleteDevice);
        deleteElem.setAttribute("data-mrid", iedMrid);
        iedHeading.appendChild(deleteElem);

        iedElem.appendChild(iedHeading);

        // And create the empty definition list for this item
        oldDlElem = document.createElement("table");
        iedElem.appendChild(oldDlElem);
        devices.appendChild(iedElem);
    }

    // Handle the update by creating the new definition list and then replacing
    // the one in the iedElem
    const newDlElem = createDeviceDefinition(evtData);
    iedElem.replaceChild(newDlElem, oldDlElem);
}

document.addEventListener("DOMContentLoaded", () => {
    // Subscribe to server sent events
    const evtSource = new EventSource("/sse");
    evtSource.onmessage = (e) => {
        const evtData = JSON.parse(e.data);
        addOrUpdate(evtData);
    };

    // Connect the UI buttons for devices
    document.getElementById("create-device")
        .addEventListener("click", createNewDevice);
});
