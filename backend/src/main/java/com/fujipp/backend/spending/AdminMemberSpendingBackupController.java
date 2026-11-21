package com.fujipp.backend.spending;

import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/bots/{botId}/licenses/{licenseId}/member-spending/backup")
@PreAuthorize("hasRole('ADMIN')")
class AdminMemberSpendingBackupController {
    private final MemberSpendingBackupService service;
    AdminMemberSpendingBackupController(MemberSpendingBackupService service) { this.service=service; }
    @GetMapping
    ResponseEntity<MemberSpendingBackupService.Quota> quota(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID botId,@PathVariable UUID licenseId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.quota(jwt.getSubject(),botId,licenseId,true));
    }
    @PostMapping
    ResponseEntity<byte[]> download(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId,@PathVariable UUID licenseId) {
        var backup=service.download(jwt.getSubject(),botId,licenseId,true);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType("application/zip"))
            .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(backup.filename()).build().toString())
            .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,HttpHeaders.CONTENT_DISPOSITION)
            .body(backup.bytes());
    }
}
