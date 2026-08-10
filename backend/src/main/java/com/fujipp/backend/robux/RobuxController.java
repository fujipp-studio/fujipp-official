package com.fujipp.backend.robux;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/internal/v1/robux")
class RobuxController {
    private final RobuxService service;
    RobuxController(RobuxService service){this.service=service;}
    @PostMapping("/jobs") RobuxResponses.Job begin(@Valid @RequestBody RobuxRequests.Begin body){return service.begin(body);}
    @PostMapping("/jobs/{jobId}/claim") RobuxResponses.Job claim(@RequestParam UUID botId,@PathVariable UUID jobId){return service.claim(botId,jobId);}
    @PostMapping("/jobs/{jobId}/outcome") RobuxResponses.Outcome outcome(@RequestParam UUID botId,@PathVariable UUID jobId,@Valid @RequestBody RobuxRequests.Outcome body){return service.outcome(botId,jobId,body);}
    @PostMapping("/jobs/{jobId}/refund") RobuxResponses.Refund refund(@RequestParam UUID botId,@PathVariable UUID jobId,@Valid @RequestBody RobuxRequests.Failure body){return service.refund(botId,jobId,body);}
    @GetMapping("/jobs/recoverable") RobuxResponses.Recoverable recoverable(@RequestParam UUID botId){return service.recoverable(botId);}
}
