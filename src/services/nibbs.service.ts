import "dotenv/config";
import https from "https";

const NIBBS_HOST = "nibssbyphoenix.onrender.com";
const NIBBS_IP = "216.24.57.18";

export async function getNibbsToken(): Promise<string> {
  const requestBody = JSON.stringify({
    apiKey: process.env.NIBBS_API_KEY,
    apiSecret: process.env.NIBBS_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: NIBBS_IP,
        port: 443,
        path: "/api/auth/token",
        method: "POST",
        servername: NIBBS_HOST,
        headers: {
          Host: NIBBS_HOST,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
      },
      (response) => {
        let body = "";

        response.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });

        response.on("end", () => {
          if (
            response.statusCode &&
            response.statusCode >= 200 &&
            response.statusCode < 300
          ) {
            try {
              const data = JSON.parse(body);

              if (!data.token) {
                reject(
                  new Error(
                    "NIBBS authentication succeeded but no token was returned.",
                  ),
                );
                return;
              }

              resolve(data.token);
            } catch {
              reject(new Error("NIBBS returned an invalid JSON response."));
            }

            return;
          }

          reject(
            new Error(
              `NIBBS authentication failed with status ${response.statusCode}: ${body}`,
            ),
          );
        });
      },
    );

    request.on("error", reject);

    request.write(requestBody);
    request.end();
  });
}

export async function nibbsRequest<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const token = await getNibbsToken();

  const requestBody = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: NIBBS_IP,
        port: 443,
        path,
        method,
        servername: NIBBS_HOST,
        headers: {
          Host: NIBBS_HOST,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(requestBody
            ? {
                "Content-Length": Buffer.byteLength(requestBody),
              }
            : {}),
        },
      },
      (response) => {
        let responseBody = "";

        response.on("data", (chunk: Buffer) => {
          responseBody += chunk.toString();
        });

        response.on("end", () => {
          try {
            const data = responseBody ? JSON.parse(responseBody) : {};

            if (
              response.statusCode &&
              response.statusCode >= 200 &&
              response.statusCode < 300
            ) {
              resolve(data as T);
              return;
            }

            reject(
              new Error(
                `NIBBS request failed (${response.statusCode}): ${responseBody}`,
              ),
            );
          } catch {
            reject(
              new Error(`NIBBS returned an invalid response: ${responseBody}`),
            );
          }
        });
      },
    );

    request.on("error", reject);

    if (requestBody) {
      request.write(requestBody);
    }

    request.end();
  });
}

export interface InsertBvnRequest {
  bvn: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
}

export async function insertBvn(data: InsertBvnRequest): Promise<unknown> {
  return nibbsRequest("/api/insertBvn", "POST", data);
}
export async function validateBvn(bvn: string): Promise<unknown> {
  return nibbsRequest("/api/validateBvn", "POST", {
    bvn,
  });
}
export async function insertNin(
  nin: string,
  firstName: string,
  lastName: string,
  dob: string,
): Promise<unknown> {
  return nibbsRequest("/api/insertNin", "POST", {
    nin,
    firstName,
    lastName,
    dob,
  });
}
export async function validateNin(nin: string): Promise<unknown> {
  return nibbsRequest("/api/validateNin", "POST", {
    nin,
  });
}
export async function createNibbsAccount(
  kycType: string,
  kycID: string,
  dob: string,
): Promise<unknown> {
  return nibbsRequest("/api/account/create", "POST", {
    kycType,
    kycID,
    dob,
  });
}
export async function getNibbsAccounts(): Promise<unknown> {
  return nibbsRequest("/api/accounts", "GET");
}
export async function transferThroughNibbs(
  from: string,
  to: string,
  amount: number,
): Promise<any> {
  return nibbsRequest("/api/transfer", "POST", {
    from,
    to,
    amount,
  });
}
