#include "RateLimiter.h"
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <winsock2.h>
#include <ws2tcpip.h>

#pragma comment(lib, "Ws2_32.lib")

std::string extractKeyFromJson(const std::string &json) {
  std::string keyField = "\"key\"";
  size_t pos = json.find(keyField);
  if (pos == std::string::npos)
    return "default";
  pos = json.find(":", pos);
  if (pos == std::string::npos)
    return "default";
  size_t startQuote = json.find("\"", pos);
  if (startQuote == std::string::npos)
    return "default";
  size_t endQuote = json.find("\"", startQuote + 1);
  if (endQuote == std::string::npos)
    return "default";
  return json.substr(startQuote + 1, endQuote - startQuote - 1);
}

std::unordered_map<std::string, RateLimiter::RateConfig>
parseLimitsJson(const std::string &filename) {
  std::unordered_map<std::string, RateLimiter::RateConfig> rates;
  std::ifstream file(filename);
  if (!file.is_open())
    return rates;

  std::string content((std::istreambuf_iterator<char>(file)),
                      std::istreambuf_iterator<char>());

  size_t pos = 0;
  while ((pos = content.find("\"", pos)) != std::string::npos) {
    size_t endQuote = content.find("\"", pos + 1);
    if (endQuote == std::string::npos)
      break;
    std::string key = content.substr(pos + 1, endQuote - pos - 1);
    pos = endQuote + 1;

    // Skip common keys that are properties, we want top level keys
    if (key == "capacity" || key == "refillRate" || key == "default")
      continue;
    if (key.find('/') == std::string::npos && key != "default") {
      // Not a path-like key, might be a property of an outer object we didn't
      // parse properly, but in our format keys have '/' Actually, "default"
      // doesn't have '/', but we skip it above or handle it. Let's just look
      // for the block.
    }

    size_t colonPos = content.find(":", pos);
    if (colonPos == std::string::npos)
      break;

    // Find capacity
    size_t capPos = content.find("\"capacity\"", colonPos);
    if (capPos == std::string::npos)
      break;
    size_t capColon = content.find(":", capPos);
    size_t capNumStart = content.find_first_of("0123456789.", capColon);
    double capacity = std::stod(content.substr(capNumStart));

    // Find refillRate
    size_t refPos = content.find("\"refillRate\"", capColon);
    if (refPos == std::string::npos)
      break;
    size_t refColon = content.find(":", refPos);
    size_t refNumStart = content.find_first_of("0123456789.", refColon);
    double refillRate = std::stod(content.substr(refNumStart));

    rates[key] = {capacity, refillRate};
    pos = refNumStart;
  }

  // Quick parse for "default" if it exists
  size_t defPos = content.find("\"default\"");
  if (defPos != std::string::npos) {
    size_t capPos = content.find("\"capacity\"", defPos);
    if (capPos != std::string::npos) {
      size_t capColon = content.find(":", capPos);
      size_t capNumStart = content.find_first_of("0123456789.", capColon);
      double capacity = std::stod(content.substr(capNumStart));

      size_t refPos = content.find("\"refillRate\"", capColon);
      size_t refColon = content.find(":", refPos);
      size_t refNumStart = content.find_first_of("0123456789.", refColon);
      double refillRate = std::stod(content.substr(refNumStart));
      rates["default"] = {capacity, refillRate};
    }
  }

  return rates;
}

void handleClient(SOCKET clientSocket, RateLimiter *rateLimiter) {
  char buffer[4096];
  std::string clientBuffer;

  while (true) {
    int bytesReceived = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);
    if (bytesReceived <= 0)
      break;
    buffer[bytesReceived] = '\0';
    clientBuffer += buffer;

    while (true) {
      size_t headersEnd = clientBuffer.find("\r\n\r\n");
      if (headersEnd == std::string::npos)
        break; // Need more data for headers

      size_t contentLength = 0;
      size_t clPos = clientBuffer.find("Content-Length: ");
      if (clPos != std::string::npos && clPos < headersEnd) {
        size_t clEnd = clientBuffer.find("\r\n", clPos);
        if (clEnd != std::string::npos && clEnd < headersEnd) {
          contentLength = std::atoi(
              clientBuffer.substr(clPos + 16, clEnd - clPos - 16).c_str());
        }
      }

      if (clientBuffer.size() < headersEnd + 4 + contentLength) {
        break; // Need more data for body
      }

      std::string request =
          clientBuffer.substr(0, headersEnd + 4 + contentLength);
      clientBuffer.erase(0, headersEnd + 4 + contentLength);

      std::string response;
      if (request.find("POST /check") == 0) {
        std::string body = request.substr(headersEnd + 4);
        std::string key = extractKeyFromJson(body);

        long long waitForMs = rateLimiter->acquire(key, 1);
        std::string allowedStr = (waitForMs == 0) ? "true" : "false";

        std::string jsonResponse =
            "{\"allowed\": " + allowedStr +
            ", \"waitForMs\": " + std::to_string(waitForMs) + "}";
        response =
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: "
            "keep-alive\r\nContent-Length: " +
            std::to_string(jsonResponse.length()) + "\r\n\r\n" + jsonResponse;
      } else if (request.find("GET /status") == 0) {
        auto statusMap = rateLimiter->getStatus();
        std::string jsonResponse = "{";
        bool first = true;
        for (const auto &pair : statusMap) {
          if (!first)
            jsonResponse += ",";
          jsonResponse +=
              "\"" + pair.first + "\": {\"currentCapacity\": " +
              std::to_string(pair.second.currentCapacity) +
              ", \"maxCapacity\": " + std::to_string(pair.second.maxCapacity) +
              "}";
          first = false;
        }
        jsonResponse += "}";
        response = "HTTP/1.1 200 OK\r\nContent-Type: "
                   "application/json\r\nAccess-Control-Allow-Origin: "
                   "*\r\nConnection: keep-alive\r\nContent-Length: " +
                   std::to_string(jsonResponse.length()) + "\r\n\r\n" +
                   jsonResponse;
      } else if (request.find("OPTIONS /status") == 0) {
        // Handle CORS preflight just in case
        response = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: "
                   "*\r\nAccess-Control-Allow-Methods: GET, "
                   "OPTIONS\r\nConnection: keep-alive\r\n\r\n";
      } else {
        response = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: "
                   "close\r\n\r\n";
        send(clientSocket, response.c_str(), response.length(), 0);
        closesocket(clientSocket);
        return;
      }

      int sendResult =
          send(clientSocket, response.c_str(), response.length(), 0);
      if (sendResult == SOCKET_ERROR) {
        closesocket(clientSocket);
        return;
      }
    }
  }
  closesocket(clientSocket);
}

struct ClientData {
  SOCKET clientSocket;
  RateLimiter *rateLimiter;
};

DWORD WINAPI handleClientWrapper(LPVOID lpParam) {
  ClientData *data = (ClientData *)lpParam;
  handleClient(data->clientSocket, data->rateLimiter);
  delete data;
  return 0;
}

int main() {
  WSADATA wsaData;
  if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
    std::cerr << "WSAStartup failed." << std::endl;
    return 1;
  }

  SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (serverSocket == INVALID_SOCKET) {
    std::cerr << "Socket creation failed." << std::endl;
    WSACleanup();
    return 1;
  }

  char optval = 1;
  setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, &optval, sizeof(optval));

  sockaddr_in serverAddr;
  serverAddr.sin_family = AF_INET;
  serverAddr.sin_addr.s_addr = INADDR_ANY;
  serverAddr.sin_port = htons(8080);

  if (bind(serverSocket, (SOCKADDR *)&serverAddr, sizeof(serverAddr)) ==
      SOCKET_ERROR) {
    std::cerr << "Bind failed." << std::endl;
    closesocket(serverSocket);
    WSACleanup();
    return 1;
  }

  if (listen(serverSocket, SOMAXCONN) == SOCKET_ERROR) {
    std::cerr << "Listen failed." << std::endl;
    closesocket(serverSocket);
    WSACleanup();
    return 1;
  }

  std::cout << "C++ Rate Limiter running on port 8080..." << std::endl;

  std::unordered_map<std::string, RateLimiter::RateConfig> keyRates =
      parseLimitsJson("limits.json");
  if (keyRates.empty()) {
    std::cout
        << "Warning: limits.json not found or empty. Using default rate of 50."
        << std::endl;
  } else {
    std::cout << "Loaded " << keyRates.size()
              << " token bucket limits from limits.json." << std::endl;
  }

  double defaultRate = 50.0;
  if (keyRates.count("default")) {
    defaultRate = keyRates["default"]
                      .capacity; // Use capacity as default rate for simplicity
    keyRates.erase("default");
  }

  RateLimiter rateLimiter(defaultRate, keyRates);

  while (true) {
    SOCKET clientSocket = accept(serverSocket, NULL, NULL);
    if (clientSocket != INVALID_SOCKET) {
      // Disable Nagle's algorithm for instant response dispatch
      char nodelay = 1;
      setsockopt(clientSocket, IPPROTO_TCP, TCP_NODELAY, &nodelay, sizeof(nodelay));

      ClientData *data = new ClientData{clientSocket, &rateLimiter};
      HANDLE thread = CreateThread(NULL, 0, handleClientWrapper, data, 0, NULL);
      if (thread)
        CloseHandle(thread);
    }
  }

  closesocket(serverSocket);
  WSACleanup();
  return 0;
}
