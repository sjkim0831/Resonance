package egovframework.com.feature.emission.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "emission_mapping_log")
@Getter
@Setter
public class EmissionMappingLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String rawMaterialName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mapped_material_id")
    private EcoinventMaster mappedMaterial;

    @Column
    private String note;
}
