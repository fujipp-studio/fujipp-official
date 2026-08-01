package com.fujipp.backend.store;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bots")
public class BotController {

    private final StoreService storeService;

    public BotController(StoreService storeService) {
        this.storeService = storeService;
    }

    @GetMapping
    public List<BotResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return storeService.listBots(jwt.getSubject());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BotResponse create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateBotRequest request
    ) {
        return storeService.createBot(jwt.getSubject(), request);
    }

    @PutMapping("/{botId}/credentials/discord-token")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateDiscordToken(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID botId,
            @Valid @RequestBody UpdateDiscordTokenRequest request
    ) {
        storeService.updateDiscordToken(jwt.getSubject(), botId, request);
    }
}
