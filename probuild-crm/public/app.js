const statuses = [
  "New Lead", "Contacted", "Site Inspection", "Quotation Sent", "Negotiation",
  "Contract Signed", "Design", "Permit Approval", "Construction",
  "Final Inspection", "Handover", "Warranty", "Completed"
];

let customers = [];
let token = localStorage.getItem("crm_token");
let currentUser = JSON.parse(localStorage.getItem("crm_user") || "null");

const api = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      ...(options.headers || {})
    }
  });

  if (!res.ok) throw new Error("Request failed");
  return res.json();
};

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}
function initStatusOptions() {
  document.getElementById("status").innerHTML = statuses
    .map(s => `<option value="${s}">${s}</option>`)
    .join("");
}

async function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) return alert("Wrong email or password");

  const data = await res.json();

  token = data.token;
  currentUser = data.user;

  localStorage.setItem("crm_token", token);
  localStorage.setItem("crm_user", JSON.stringify(currentUser));

  showApp();
}

function logout() {
  localStorage.removeItem("crm_token");
  localStorage.removeItem("crm_user");
  location.reload();
}

function showApp() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");
  document.getElementById("userInfo").innerText = `${currentUser.name} (${currentUser.role})`;
  loadCustomers();
}

async function loadCustomers() {
  customers = await api("/api/customers");
  renderDashboard();
  renderPipeline();
  renderCustomers();
}

function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.getElementById("pageTitle").innerText =
    id.charAt(0).toUpperCase() + id.slice(1);
}

function renderDashboard() {
  const total = customers.length;
  const construction = customers.filter(c => c.status === "Construction").length;
  const negotiation = customers.filter(c => c.status === "Negotiation").length;
  const completed = customers.filter(c => c.status === "Completed").length;
  const followUps = customers.filter(c => c.due_date).length;

  document.getElementById("dashboard").innerHTML = `
    <div class="cards">
      <div class="card"><h3>Total Customers</h3><strong>${total}</strong></div>
      <div class="card"><h3>Negotiation</h3><strong>${negotiation}</strong></div>
      <div class="card"><h3>Construction</h3><strong>${construction}</strong></div>
      <div class="card"><h3>Completed</h3><strong>${completed}</strong></div>
    </div>

    <div class="card">
      <h3>Follow-up Tasks</h3>
      <strong>${followUps}</strong>
      <p>Use this to track customers who need calls, quotation updates, contract reminders, or site progress checks.</p>
    </div>
  `;
}

function renderPipeline() {
  const html = `<div class="pipeline">` + statuses.map(status => {
    const list = customers.filter(c => c.status === status);

    return `
      <div class="column" ondragover="allowDrop(event)" ondrop="dropCustomer(event, '${status}')">
        <h3>${status} (${list.length})</h3>

        ${list.map(c => `
          <div class="lead-card" draggable="true" ondragstart="dragCustomer(event, ${c.id})">
            <h4>${c.customer_name}</h4>

            <p>${c.project_type || "-"}</p>

            <p><b>Budget:</b> ${c.budget || "-"}</p>

            <p><b>Assigned:</b> ${c.assigned_to || "-"}</p>

            <p><b>Created By:</b> ${c.created_by || "-"}</p>

            <p><b>Next:</b> ${c.next_action || "-"}</p>

            <p><b>Last Edited By:</b> ${c.last_edited_by || "-"}</p>

            <p><b>Last Updated:</b> ${formatDate(c.last_updated)}</p>

            <button onclick="editCustomer(${c.id})">Open</button>
          </div>
        `).join("")}
      </div>
    `;
  }).join("") + `</div>`;

  document.getElementById("pipeline").innerHTML = html;
}

function dragCustomer(event, customerId) {
  event.dataTransfer.setData("customerId", customerId);
}

function allowDrop(event) {
  event.preventDefault();
}

async function dropCustomer(event, newStatus) {
  event.preventDefault();

  const customerId = event.dataTransfer.getData("customerId");
  const customer = customers.find(c => c.id == customerId);

  if (!customer) return;

  customer.status = newStatus;

  await api("/api/customers/" + customerId, {
    method: "PUT",
    body: JSON.stringify(customer)
  });

  await loadCustomers();
}

function renderCustomers() {
  document.getElementById("customers").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Customer</th>
          <th>Phone</th>
          <th>Project</th>
          <th>Budget</th>
          <th>Status</th>
          <th>Assigned</th>
          <th>Created By</th>
          <th>Next Action</th>
          <th>Last Edited By</th>
          <th>Last Updated</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        ${customers.map(c => `
          <tr>
            <td>${c.customer_name}</td>
            <td>${c.phone || "-"}</td>
            <td>${c.project_type || "-"}</td>
            <td>${c.budget || "-"}</td>
            <td><span class="badge">${c.status}</span></td>
            <td>${c.assigned_to || "-"}</td>
            <td>${c.created_by || "-"}</td>
            <td>${c.next_action || "-"}</td>
            <td>${c.last_edited_by || "-"}</td>
            <td>${formatDate(c.last_updated)}</td>
            <td class="actions">
              <button onclick="editCustomer(${c.id})">Edit</button>
              <button class="delete" onclick="deleteCustomer(${c.id})">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function openModal() {
  document.getElementById("modalTitle").innerText = "Add Customer";
  document.getElementById("customerId").value = "";

  [
    "customer_name",
    "phone",
    "email",
    "project_address",
    "project_type",
    "budget",
    "assigned_to",
    "next_action",
    "due_date",
    "notes"
  ].forEach(id => {
    document.getElementById(id).value = "";
  });

  document.getElementById("status").value = "New Lead";

  document.getElementById("createdBy").innerText = "-";
  document.getElementById("lastEditedBy").innerText = "-";
  document.getElementById("lastUpdated").innerText = "-";

  document.getElementById("customerModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("customerModal").classList.add("hidden");
}

function editCustomer(id) {
  const c = customers.find(x => x.id === id);

  document.getElementById("modalTitle").innerText = "Edit Customer";
  document.getElementById("customerId").value = c.id;

  [
    "customer_name",
    "phone",
    "email",
    "project_address",
    "project_type",
    "budget",
    "status",
    "assigned_to",
    "next_action",
    "due_date",
    "notes"
  ].forEach(k => {
    document.getElementById(k).value = c[k] || "";
  });

  document.getElementById("createdBy").innerText = c.created_by || "-";
  document.getElementById("lastEditedBy").innerText = c.last_edited_by || "-";
  document.getElementById("lastUpdated").innerText = formatDate(c.last_updated);

  document.getElementById("customerModal").classList.remove("hidden");
}

async function saveCustomer() {
  const id = document.getElementById("customerId").value;
  const data = {};

  [
    "customer_name",
    "phone",
    "email",
    "project_address",
    "project_type",
    "budget",
    "status",
    "assigned_to",
    "next_action",
    "due_date",
    "notes"
  ].forEach(k => {
    data[k] = document.getElementById(k).value;
  });

  if (!data.customer_name) return alert("Customer name is required");

  if (id) {
    await api("/api/customers/" + id, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  } else {
    await api("/api/customers", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  closeModal();
  loadCustomers();
}

async function deleteCustomer(id) {
  if (!confirm("Delete this customer?")) return;

  await api("/api/customers/" + id, {
    method: "DELETE"
  });

  loadCustomers();
}

initStatusOptions();

if (token && currentUser) {
  showApp();
}
