# Architecture and data flow

PingMetric is a static Angular application. The browser calls external services directly; nothing is sent to a PingMetric backend because there is none.

## Services

| Service                 | Responsibility                                                          |
| ----------------------- | ----------------------------------------------------------------------- |
| `AuthService`           | SHA-1 Web Crypto comparison and an expiry-aware local unlocked session. |
| `SpeedTestService`      | M-Lab server discovery and NDT7 download/upload callbacks.              |
| `LatencyService`        | Warm-up plus repeated, bounded HTTP/application timings.                |
| `IpAddressService`      | Independent JSON IP endpoint requests with timeout states.              |
| `IpIntelligenceService` | Validates and normalizes ipapi.is responses.                            |
| `WebRtcLeakService`     | Short, local ICE gathering and cautious candidate comparison.           |
| `HistoryService`        | Versioned normalized results in localStorage.                           |

NDT7 server discovery is not hard-coded. Its library is configured with PingMetric metadata and `userAcceptedDataPolicy: true` only after local disclosure acceptance. The package’s two workers are copied as Angular static assets and resolved from the document base URL, which works under `/ping-metric/` on GitHub Pages.

## Calculations

- Mbps: `bytes × 8 / elapsed microseconds`. This is equivalent to megabits per second because bytes are multiplied by 8 and elapsed time is microseconds.
- HTTP jitter: mean absolute difference between consecutive timing samples.
- TCP retransmission estimate: `BytesRetrans / BytesSent × 100` only when both values are valid. It is not packet loss.
- TCP durations are converted from microseconds to milliseconds by dividing by 1,000.

NDT7 field availability varies. Optional fields remain absent instead of producing made-up values.
