package com.fujipp.backend.store;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/bots")
@PreAuthorize("hasRole('ADMIN')")
public class AdminBotController {
    private final AdminBotService service;

    public AdminBotController(AdminBotService service) { this.service = service; }

    @GetMapping
    public List<AdminStoreResponses.Bot> list(@RequestParam(required = false) String query) {
        return service.list(query);
    }

    @GetMapping("/{botId}/settings")
    public BotResponse settings(@PathVariable UUID botId) { return service.settings(botId); }

    @GetMapping("/{botId}/licenses")
    public List<LicenseResponse> licenses(@PathVariable UUID botId){return service.licenses(botId);}

    @GetMapping("/{botId}/licenses/{licenseId}/configuration")
    public FeatureConfigurationResponse configuration(@PathVariable UUID botId,@PathVariable UUID licenseId){
        return service.configuration(botId,licenseId);
    }

    @PutMapping("/{botId}/licenses/{licenseId}/configuration")
    public FeatureConfigurationResponse updateConfiguration(@PathVariable UUID botId,@PathVariable UUID licenseId,
            @Valid @RequestBody UpdateFeatureConfigurationRequest request){
        return service.updateConfiguration(botId,licenseId,request);
    }

    @PutMapping("/{botId}/settings")
    public BotResponse updateSettings(@PathVariable UUID botId, @Valid @RequestBody UpdateBotRequest request) {
        return service.updateSettings(botId, request);
    }

    @PostMapping("/{botId}/transfer")
    public AdminStoreResponses.Bot transfer(
            @PathVariable UUID botId,
            @Valid @RequestBody AdminStoreRequests.TransferBotRequest request
    ) {
        return service.transfer(botId, request.newOwnerUserId(), request.keepRunning());
    }

    @PostMapping("/{botId}/start")
    public AdminStoreResponses.Bot start(@PathVariable UUID botId) {
        return service.control(botId, "start");
    }

    @PostMapping("/{botId}/stop")
    public AdminStoreResponses.Bot stop(@PathVariable UUID botId) {
        return service.control(botId, "stop");
    }

    @PostMapping("/{botId}/restart")
    public AdminStoreResponses.Bot restart(@PathVariable UUID botId) {
        return service.control(botId, "restart");
    }
}
