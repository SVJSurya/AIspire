const API_BASE = "http://127.0.0.1:5000";

let jobs = [];

// ✅ New function for logging audits
async function logAudit(action, details) {
    const device = navigator.userAgent;
    try {
        await fetch(`${API_BASE}/log_audit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device, action, details })
        });
    } catch (err) {
        console.error("Audit log failed:", err);
    }
}

// Load jobs from backend
async function loadJobs() {
    try {
        const res = await fetch(`${API_BASE}/get_embeddings`);
        jobs = await res.json();
        renderJobs();
    } catch (err) {
        console.error("Error loading jobs:", err);
    }
}

function renderJobs() {
    const tableBody = document.getElementById("jobTableBody");
    tableBody.innerHTML = "";
    jobs.forEach((job, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="border px-4 py-2">${job.code}</td>
            <td class="border px-4 py-2">${job.title}</td>
            <td class="border px-4 py-2">${job.description}</td>
            <td class="border px-4 py-2">
                <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded" onclick="editJob(${index})">✏ Edit</button>
                <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded" onclick="deleteJob(${index})">🗑 Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function editJob(index) {
    document.getElementById("editIndex").value = index;
    document.getElementById("jobCode").value = jobs[index].code;
    document.getElementById("jobTitle").value = jobs[index].title;
    document.getElementById("jobDescription").value = jobs[index].description;
}

function deleteJob(index) {
    if (confirm("Are you sure you want to delete this job?")) {
        const deletedJob = jobs[index]; // ✅ Keep record for audit
        jobs.splice(index, 1);
        logAudit("Delete", deletedJob); // ✅ Audit log
        saveJobs();
    }
}

document.getElementById("jobForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const index = document.getElementById("editIndex").value;
    const newJob = {
        code: document.getElementById("jobCode").value,
        title: document.getElementById("jobTitle").value,
        description: document.getElementById("jobDescription").value
    };

    if (index !== "") {
        logAudit("Edit", { old: jobs[index], new: newJob }); // ✅ Audit log
        jobs[index] = newJob; // Update existing
    } else {
        logAudit("Add", newJob); // ✅ Audit log
        jobs.push(newJob); // Add new
    }

    await saveJobs();
    this.reset();
    document.getElementById("editIndex").value = "";
});

async function saveJobs() {
    try {
        const res = await fetch(`${API_BASE}/update_embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: jobs })
        });
        const result = await res.json();
        if (result.status === "success") {
            alert("Jobs updated successfully!");
            renderJobs();
        } else {
            alert("Error updating jobs: " + result.message);
        }
    } catch (err) {
        console.error("Error saving jobs:", err);
    }
}

document.getElementById("downloadBtn").addEventListener("click", function () {
    const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "updated_jobs.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

window.onload = loadJobs;
