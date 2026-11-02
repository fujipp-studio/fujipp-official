package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class FeatureConfigurationChecksTests {
    private final ObjectMapper json=new ObjectMapper();
    private FeatureConfigurationResponse config(FeatureConfigurationResponse.FieldResponse... fields) {
        return new FeatureConfigurationResponse(UUID.randomUUID(),0,null,List.of(fields),List.of());
    }
    private FeatureConfigurationResponse.FieldResponse field(String key,String type,boolean required,boolean secret,boolean configured,JsonNode value,String schema) {
        return new FeatureConfigurationResponse.FieldResponse(key,key,null,type,required,secret,null,value,configured,json.readTree(schema),null);
    }
    @Test void missingRequiredChannelBlocksSaveWithoutExposingValues() {
        var saved=config(field("REVIEW_CHANNEL_ID","CHANNEL_ID",true,false,false,null,"{}"));
        assertThatThrownBy(()->FeatureConfigurationChecks.validate(saved,Map.of(),Map.of()))
            .isInstanceOf(StoreValidationException.class).hasMessageContaining("REVIEW_CHANNEL_ID").hasMessageContaining("required");
        assertThatThrownBy(()->FeatureConfigurationChecks.validate(saved,Map.of("REVIEW_CHANNEL_ID",json.valueToTree("not-a-channel")),Map.of()))
            .hasMessageContaining("Discord ID");
    }
    @Test void correctedDraftOverridesInvalidSavedRange() {
        var saved=config(field("PRESENCE_ROTATE_SECONDS","NUMBER",true,false,true,json.valueToTree(1),"{}"));
        assertThatThrownBy(()->FeatureConfigurationChecks.validate(saved,Map.of(),Map.of())).hasMessageContaining("20 to 86400");
        assertThat(FeatureConfigurationChecks.validate(saved,Map.of("PRESENCE_ROTATE_SECONDS",json.valueToTree(20)),Map.of()))
            .containsEntry("PRESENCE_ROTATE_SECONDS",json.valueToTree(20));
    }
    @Test void configuredSecretsRemainRedactedAndIncomingKeyIsTrimmed() {
        var saved=config(field("GEMINI_API_KEY","SECRET",true,true,true,null,"{\"pattern\":\"^[A-Za-z0-9_.-]+$\"}"));
        assertThat(FeatureConfigurationChecks.validate(saved,Map.of(),Map.of())).isEmpty();
        assertThat(FeatureConfigurationChecks.validate(saved,Map.of(),Map.of("GEMINI_API_KEY","  AQ.synthetic-customer.gemini-key  "))).isEmpty();
        assertThatThrownBy(()->FeatureConfigurationChecks.validate(saved,Map.of(),Map.of("GEMINI_API_KEY","invalid key")))
            .hasMessageContaining("invalid format").hasMessageNotContaining("invalid key");
    }
    @Test void nestedSchemaAndSavedFieldsAreValidatedTogether() {
        var saved=config(field("RULES","JSON",true,false,true,json.readTree("[{\"count\":2}]"),
            "{\"type\":\"array\",\"items\":{\"type\":\"object\",\"required\":[\"count\"],\"properties\":{\"count\":{\"type\":\"integer\",\"minimum\":1}}}}"));
        assertThat(FeatureConfigurationChecks.validate(saved,Map.of(),Map.of())).containsKey("RULES");
        assertThatThrownBy(()->FeatureConfigurationChecks.validate(saved,Map.of("RULES",json.readTree("[{\"count\":0}]")),Map.of())).hasMessageContaining("RULES[0].count");
    }
}
