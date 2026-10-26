package com.fujipp.backend.spending;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
@Validated
@RestController @RequestMapping("/internal/v1/member-spending") public class MemberSpendingController {
    private final MemberSpendingService service;
    public MemberSpendingController(MemberSpendingService service){this.service=service;}
    @PostMapping("/add") public MemberSpendingRepository.Entry add(@Valid @RequestBody AddRequest r){return service.add(r.botId(),r.memberDiscordId(),r.deltaSatang(),r.operationKey());}
    @PutMapping public MemberSpendingRepository.Entry set(@Valid @RequestBody SetRequest r){return service.set(r.botId(),r.memberDiscordId(),r.amountSatang(),r.txCount(),r.operationKey());}
    @GetMapping public MemberSpendingRepository.Entry get(@RequestParam UUID botId,@RequestParam @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId,@RequestParam(required=false) @Pattern(regexp="^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$") String month){var entry=service.get(botId,memberDiscordId,month);return entry==null?new MemberSpendingRepository.Entry(memberDiscordId,0,0,0,0):entry;}
    @DeleteMapping public boolean remove(@RequestParam UUID botId,@RequestParam @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId,@RequestParam @NotBlank @Size(max=100) String operationKey){return service.remove(botId,memberDiscordId,operationKey);}
    @GetMapping("/leaderboard") public List<MemberSpendingRepository.Entry> leaderboard(@RequestParam UUID botId,@RequestParam(defaultValue="100") int limit,@RequestParam(required=false) @Pattern(regexp="^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$") String month){return service.leaderboard(botId,limit,month);}
    @GetMapping("/totals") public MemberSpendingRepository.Totals totals(@RequestParam UUID botId,@RequestParam(required=false) @Pattern(regexp="^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$") String month){return service.totals(botId,month);}
    public record AddRequest(@NotNull UUID botId,@NotBlank @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId,@Min(1) long deltaSatang,@NotBlank @Size(max=100) String operationKey){}
    public record SetRequest(@NotNull UUID botId,@NotBlank @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId,@Min(0) Long amountSatang,@Min(0) Integer txCount,@NotBlank @Size(max=100) String operationKey){}
}
