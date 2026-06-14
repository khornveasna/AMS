const { execSync } = require('child_process');
const os = require('os');

// Colors for terminal output
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  
  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    // Skip virtual/WSL/docker interfaces
    if (
      lowerName.includes('virtual') ||
      lowerName.includes('vbox') ||
      lowerName.includes('vmware') ||
      lowerName.includes('wsl') ||
      lowerName.includes('docker') ||
      lowerName.includes('vethernet') ||
      lowerName.includes('loopback')
    ) {
      continue;
    }
    
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }
  
  // Prioritize Wi-Fi and Ethernet
  const prioritized = candidates.find(c => {
    const lower = c.name.toLowerCase();
    return lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('ethernet');
  });
  
  if (prioritized) {
    return prioritized.address;
  }
  
  if (candidates.length > 0) {
    return candidates[0].address;
  }
  
  // Ultimate fallback
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function start() {
  console.log(`${CYAN}Starting Attendance Management System containers...${RESET}\n`);
  
  try {
    // Run docker-compose up in background (-d) and build
    execSync('docker compose up --build -d', { stdio: 'inherit' });
    
    const ip = getNetworkIP();
    
    console.log('\n' + '='.repeat(60));
    console.log(`  ${GREEN}${BOLD}🚀 ATTENDANCE MANAGEMENT SYSTEM (AMS) IS READY!${RESET}`);
    console.log('='.repeat(60) + '\n');
    
    console.log(`  ${BLUE}${BOLD}➜  Frontend App (Web UI):${RESET}`);
    console.log(`     ${BOLD}Local:${RESET}    ${CYAN}http://localhost:3000/${RESET}`);
    console.log(`     ${BOLD}Network:${RESET}  ${CYAN}http://${ip}:3000/${RESET}\n`);
    
    console.log(`  ${BLUE}${BOLD}➜  Backend API:${RESET}`);
    console.log(`     ${BOLD}Local:${RESET}    ${CYAN}http://localhost:5025/api/${RESET}`);
    console.log(`     ${BOLD}Network:${RESET}  ${CYAN}http://${ip}:5025/api/${RESET}\n`);
    
    console.log('-'.repeat(60));
    console.log(`  ${YELLOW}${BOLD}Commands Reference:${RESET}`);
    console.log(`  ${DIM}• To view live logs:${RESET}  ${BOLD}docker compose logs -f${RESET}`);
    console.log(`  ${DIM}• To view backend logs:${RESET} ${BOLD}docker compose logs -f backend-api${RESET}`);
    console.log(`  ${DIM}• To stop services:${RESET}    ${BOLD}npm run down${RESET}`);
    console.log('-'.repeat(60) + '\n');
    
  } catch (error) {
    console.error(`\n${YELLOW}Error starting containers. Please make sure Docker Desktop is running.${RESET}`);
    process.exit(1);
  }
}

start();
