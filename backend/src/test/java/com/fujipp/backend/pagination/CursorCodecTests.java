package com.fujipp.backend.pagination;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CursorCodecTests {
    private final CursorCodec codec=new CursorCodec(JsonMapper.builder().build());

    @Test void roundTripsCursorForTheSameScopeAndFilters(){
        String cursor=codec.encode("bots","owner",List.of("2026-08-22T00:00:00Z","id"));
        assertThat(codec.decode(cursor,"bots","owner",2)).containsExactly("2026-08-22T00:00:00Z","id");
    }

    @Test void rejectsMalformedCursor(){
        assertThatThrownBy(()->codec.decode("not-base64","bots","owner",2))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test void rejectsCursorWhenFiltersChange(){
        String cursor=codec.encode("bots","owner-a",List.of("date","id"));
        assertThatThrownBy(()->codec.decode(cursor,"bots","owner-b",2))
                .isInstanceOf(ResponseStatusException.class);
    }
}
