package com.fujipp.backend.store;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import tools.jackson.databind.JsonNode;
import java.util.*;

@RestController
@RequestMapping("/internal/v1/runtime/bots/{botId}/tickets")
public class RuntimeTicketController {
    private final RuntimeTicketService tickets;
    RuntimeTicketController(RuntimeTicketService tickets) { this.tickets=tickets; }
    public record Save(@NotNull UUID installationId,@NotBlank @Size(max=100) String name,@NotNull JsonNode state) {}
    public record Archive(@NotNull UUID installationId,@NotNull JsonNode messages) {}
    @GetMapping
    ResponseEntity<List<RuntimeTicketService.Ticket>> list(@PathVariable UUID botId,@RequestParam UUID installationId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(tickets.list(botId,installationId));
    }
    @PutMapping("/{channelId}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void save(@PathVariable UUID botId,@PathVariable String channelId,@Valid @RequestBody Save request) {
        tickets.save(botId,request.installationId(),channelId,request.name(),request.state());
    }
    @PutMapping("/{channelId}/archive")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void archive(@PathVariable UUID botId,@PathVariable String channelId,@Valid @RequestBody Archive request) {
        tickets.archive(botId,request.installationId(),channelId,request.messages());
    }
}
